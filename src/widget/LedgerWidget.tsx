'use no memo';
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetModel, WidgetTone } from '../domain/widget';

/**
 * The page on the home screen.
 *
 * Same paper, same three voices, same sentence the app would say if it were
 * open. The widget is rendered to a bitmap by the library, so it uses system
 * families rather than the app's Text component: serif for the sentence,
 * monospace for the count and the actions.
 */
/** Written as literal hexes: the library types colors as `#${string}`. */
const PAPER = '#F6F2E9' as const;
const INK = '#1A1815' as const;
const INK_SOFT = '#5B544A' as const;
const RULE_STRONG = '#B9AE99' as const;
const RUST = '#A6431F' as const;
const MOSS = '#3F5A46' as const;

function accent(tone: WidgetTone): typeof INK | typeof RUST | typeof MOSS {
  if (tone === 'rust') return RUST;
  if (tone === 'moss') return MOSS;
  return INK;
}

export function LedgerWidget({ model }: { model: WidgetModel }) {
  const tone = accent(model.tone);

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'ledger:///' }}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: PAPER,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: RULE_STRONG,
        paddingHorizontal: 13,
        paddingVertical: 9,
        flexDirection: 'column',
      }}
    >
      <FlexWidget
        style={{ flexDirection: 'row', width: 'match_parent', alignItems: 'center' }}
      >
        <TextWidget
          text="THE LEDGER"
          style={{
            fontSize: 9,
            fontFamily: 'monospace',
            letterSpacing: 1.3,
            color: INK_SOFT,
          }}
        />
        <FlexWidget style={{ flex: 1 }} />
        <TextWidget
          text={model.count}
          style={{
            fontSize: 9,
            fontFamily: 'monospace',
            letterSpacing: 1.3,
            color: accent(model.countTone),
          }}
        />
      </FlexWidget>

      <FlexWidget
        style={{
          height: 1,
          width: 'match_parent',
          backgroundColor: RULE_STRONG,
          marginTop: 6,
          marginBottom: 6,
        }}
      />

      <TextWidget
        text={model.headline}
        maxLines={1}
        truncate="END"
        style={{
          fontSize: 20,
          lineHeight: 23,
          fontFamily: 'serif',
          color: tone,
        }}
      />
      <TextWidget
        text={model.detail}
        maxLines={2}
        truncate="END"
        style={{
          fontSize: 10.5,
          lineHeight: 13,
          fontFamily: 'sans-serif',
          color: INK_SOFT,
          marginTop: 2,
        }}
      />

      <FlexWidget style={{ flex: 1 }} />

      <FlexWidget
        style={{ flexDirection: 'row', width: 'match_parent', alignItems: 'center' }}
      >
        {model.action ? (
          <FlexWidget
            clickAction="OPEN_URI"
            clickActionData={{ uri: model.action.uri }}
            style={{
              backgroundColor: tone,
              borderRadius: 5,
              paddingHorizontal: 9,
              paddingVertical: 5,
            }}
          >
            <TextWidget
              text={model.action.label}
              style={{
                fontSize: 9,
                fontFamily: 'monospace',
                letterSpacing: 1.1,
                color: PAPER,
              }}
            />
          </FlexWidget>
        ) : null}
        <FlexWidget style={{ flex: 1 }} />
        {model.secondary ? (
          <TextWidget
            text={model.secondary.label}
            clickAction="OPEN_URI"
            clickActionData={{ uri: model.secondary.uri }}
            style={{
              fontSize: 8.5,
              fontFamily: 'monospace',
              letterSpacing: 1.1,
              color: RUST,
            }}
          />
        ) : null}
      </FlexWidget>
    </FlexWidget>
  );
}
