package com.zerakjamil.gatevision

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.tensorflow.lite.DataType
import org.tensorflow.lite.Interpreter
import java.io.File
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.FileChannel

/**
 * The only part of the gate that needs a device.
 *
 * It decodes one JPEG, letterboxes it to the model's input, runs the
 * interpreter and hands back the raw output buffers as bytes. It deliberately
 * does no decoding of the model's own layout: YOLO's grid and class confidence
 * live in `src/domain/vision.ts`, where they can be tested against
 * `tools/gate/probe.py` on a laptop, with no phone and no model file.
 *
 * Kept in step with the export in `tools/gate/export.py`: float32 or uint8
 * input, NHWC, contiguous output tensors.
 */
class GateVisionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GateVision")

    /** Lets JS tell "no module in this build" apart from "the model is missing". */
    Function("available") { true }

    /**
     * `image` is an absolute file path (a photo just taken) or an asset name
     * (the bundled probe). The model is always an asset: it ships in the APK,
     * because a gate that has to download its eyes is a gate that is blind in
     * the room where the phone has no signal.
     */
    AsyncFunction("infer") { modelAsset: String, image: String, threads: Int ->
      infer(modelAsset, image, threads)
    }
  }

  private fun decodeImage(raw: String): Bitmap {
    val clean = when {
      raw.startsWith("file://") -> raw.removePrefix("file://")
      else -> raw
    }
    val bitmap = if (clean.startsWith("/")) {
      val file = File(clean)
      if (!file.exists()) throw IllegalArgumentException("no such photo: $clean")
      BitmapFactory.decodeFile(clean)
    } else {
      assets().open(clean).use { BitmapFactory.decodeStream(it) }
    }
    return bitmap ?: throw IllegalStateException("not an image: $raw")
  }

  private fun assets() = appContext.reactContext?.assets
    ?: throw IllegalStateException("no asset manager")

  private fun infer(modelAsset: String, image: String, threads: Int): Map<String, Any?> {
    val started = System.currentTimeMillis()
    val handle = try {
      assets().openFd(modelAsset)
    } catch (error: Throwable) {
      throw IllegalStateException("no bundled model at $modelAsset", error)
    }

    val interpreter = try {
      val buffer = FileInputStream(handle.fileDescriptor).channel.map(
        FileChannel.MapMode.READ_ONLY,
        handle.startOffset,
        handle.declaredLength,
      )
      Interpreter(buffer, Interpreter.Options().apply {
        setNumThreads(if (threads > 0) threads else 2)
      })
    } catch (error: Throwable) {
      throw IllegalStateException("model did not load: ${error.message}", error)
    }

    try {
      val inputTensor = interpreter.getInputTensor(0)
      val shape = inputTensor.shape()
      if (shape.size != 4) throw IllegalStateException("expected a 4d input, got ${shape.toList()}")
      val height = shape[1]
      val width = shape[2]
      val channels = shape[3]

      val source = decodeImage(image)

      /**
       * Letterbox, not crop. The corners of the frame are cropped away by
       * anything else, and the dumbbell is usually at the edge of a selfie.
       */
      val scale = minOf(width.toFloat() / source.width, height.toFloat() / source.height)
      val drawWidth = Math.round(source.width * scale)
      val drawHeight = Math.round(source.height * scale)
      val padX = (width - drawWidth) / 2
      val padY = (height - drawHeight) / 2

      val square = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
      Canvas(square).apply {
        drawColor(Color.rgb(114, 114, 114))
        drawBitmap(source, null, Rect(padX, padY, padX + drawWidth, padY + drawHeight), Paint(Paint.FILTER_BITMAP_FLAG))
      }

      val pixels = IntArray(width * height)
      square.getPixels(pixels, 0, width, 0, 0, width, height)

      val isFloat = inputTensor.dataType() == DataType.FLOAT32
      val inputBuffer = ByteBuffer.allocateDirect(width * height * channels * if (isFloat) 4 else 1)
        .order(ByteOrder.nativeOrder())
      for (pixel in pixels) {
        val r = (pixel shr 16) and 0xFF
        val g = (pixel shr 8) and 0xFF
        val b = pixel and 0xFF
        if (isFloat) {
          inputBuffer.putFloat(r / 255f)
          inputBuffer.putFloat(g / 255f)
          inputBuffer.putFloat(b / 255f)
        } else {
          inputBuffer.put(r.toByte())
          inputBuffer.put(g.toByte())
          inputBuffer.put(b.toByte())
        }
      }
      inputBuffer.rewind()

      val outputs = mutableListOf<Map<String, Any?>>()
      val outputBuffers = mutableMapOf<Int, Any>()
      val outputTensors = interpreter.outputTensorCount
      for (index in 0 until outputTensors) {
        val tensor = interpreter.getOutputTensor(index)
        val shapeList = tensor.shape().toList()
        val count = shapeList.fold(1) { total, size -> total * size }
        val bytesPer = if (tensor.dataType() == DataType.FLOAT32) 4 else 1
        val buffer = ByteBuffer.allocateDirect(count * bytesPer).order(ByteOrder.nativeOrder())
        outputBuffers[index] = buffer
      }

      interpreter.runForMultipleInputsOutputs(arrayOf(inputBuffer), outputBuffers)

      for (index in 0 until outputTensors) {
        val tensor = interpreter.getOutputTensor(index)
        val buffer = outputBuffers[index] as ByteBuffer
        buffer.rewind()
        val bytes = ByteArray(buffer.remaining())
        buffer.get(bytes)
        outputs.add(
          mapOf(
            "name" to (tensor.name() ?: "output-$index"),
            "shape" to tensor.shape().toList(),
            "dtype" to if (tensor.dataType() == DataType.FLOAT32) "float32" else "uint8",
            "data" to bytes,
          ),
        )
      }

      return mapOf(
        "input" to mapOf(
          "width" to width,
          "height" to height,
          "channels" to channels,
          "dtype" to if (isFloat) "float32" else "uint8",
          "padX" to padX,
          "padY" to padY,
          "ratio" to scale,
        ),
        "outputs" to outputs,
        "ms" to (System.currentTimeMillis() - started),
      )
    } finally {
      interpreter.close()
    }
  }

}
