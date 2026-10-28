import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import type { AppState } from '../domain/state';
import { widgetModel } from '../domain/widget';
import { LedgerWidget } from './LedgerWidget';

/**
 * The app is the only writer, so every written line is also the moment the home
 * screen is allowed to change. `requestWidgetUpdate` does nothing when the user
 * has not added the widget, and a widget failure must never fail the write that
 * just happened: the ledger is the source of truth, the home screen is a copy.
 */
export async function syncWidget(state: AppState): Promise<void> {
  try {
    await requestWidgetUpdate({
      widgetName: 'Ledger',
      renderWidget: () => <LedgerWidget model={widgetModel(state)} />,
      widgetNotFound: () => undefined,
    });
  } catch {
    // No widget, no launcher support, or a headless render failure. Silence.
  }
}
