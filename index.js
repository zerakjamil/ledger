import 'expo-router/entry';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widget/task';

/**
 * The launcher can wake this bundle without opening a screen. Registering the
 * handler after the router entry keeps the normal app start unchanged; the
 * headless task runs later, when the launcher asks for a page.
 */
registerWidgetTaskHandler(widgetTaskHandler);
