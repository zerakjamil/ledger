import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { loadEvents } from '../db/events';
import { reduceEvents } from '../domain/state';
import { widgetModel, type WidgetModel } from '../domain/widget';
import { LedgerWidget } from './LedgerWidget';

/**
 * A read failure on the home screen is not a reason to show a stack trace to a
 * person about to train. It is a reason to invite them into the ledger, where
 * the error can be seen and the page can still be written.
 */
const UNREADABLE: WidgetModel = {
  mode: 'sign',
  count: 'THE LEDGER',
  headline: 'Open the ledger.',
  detail: 'The page could not be read on the home screen.',
  action: { label: 'OPEN THE PAGE', uri: 'ledger:///' },
  secondary: null,
  tone: 'ink',
  countTone: 'ink',
};

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetAction === 'WIDGET_DELETED') return;

  try {
    const events = await loadEvents();
    const state = reduceEvents(events);
    props.renderWidget(<LedgerWidget model={widgetModel(state)} />);
  } catch {
    props.renderWidget(<LedgerWidget model={UNREADABLE} />);
  }
}
