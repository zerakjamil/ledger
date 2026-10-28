import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  BODY_GROUPS,
  CATALOG,
  bodyGroupOf,
  catalogMatches,
  equipmentLabel,
  type BodyGroup,
  type CatalogRecord,
} from '../domain/catalog';
import { programSlot } from '../domain/library';
import { catalogThumb } from '../data/catalog-art';
import { color, mono, sans, serif, space } from '../theme/tokens';
import { Masthead, Notice, Rule, Screen, SectionHead, T } from '../ui/kit';

/**
 * The shelf.
 *
 * The program has eleven slots and the room can load hundreds of movements.
 * This is the whole pile, searchable, with a still frame per row: 651 GIFs
 * decoding at once would turn a scroll into a slideshow. The loop waits on the
 * detail page, where there is only one.
 */
export default function Movements() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slot?: string }>();
  const slotId = typeof params.slot === 'string' ? params.slot : undefined;
  const slot = slotId ? programSlot(slotId) : null;

  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<BodyGroup>('all');

  const list = useMemo(
    () =>
      CATALOG.filter(
        (record) =>
          (group === 'all' || bodyGroupOf(record) === group) && catalogMatches(record, query),
      ),
    [group, query],
  );

  const open = (record: CatalogRecord) => {
    router.push({
      pathname: '/movements/[id]',
      params: slotId ? { id: record.id, slot: slotId } : { id: record.id },
    });
  };

  return (
    <Screen scroll={false} style={styles.screen}>
      <View style={styles.header}>
        <Masthead title="Shelf" back={() => router.back()} />
        <Rule strong />

        {slot ? (
          <Notice tone="rust">
            Choosing for {slot.session} · {slot.movement.name}. Tap a movement, then take the slot.
          </Notice>
        ) : (
          <T variant="small">
            Every movement the dumbbells, the bar and the bench can load. Tap one to read the loop,
            or take a plan slot with it.
          </T>
        )}

        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search a movement or a muscle"
            placeholderTextColor={color.inkFaint}
            selectionColor={color.rust}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Search the movement shelf"
            style={styles.search}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear the search"
              hitSlop={10}
              onPress={() => setQuery('')}
            >
              <T variant="chapter">CLEAR</T>
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.chips}
        >
          {BODY_GROUPS.map((item) => {
            const active = group === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setGroup(item.key)}
                style={[styles.chip, active && styles.chipOn]}
              >
                <Text style={[styles.chipLabel, active && styles.chipLabelOn]}>
                  {item.label.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <SectionHead
          label={query.length > 0 || group !== 'all' ? 'MATCHES' : 'ALL MOVEMENTS'}
          right={`${list.length} of ${CATALOG.length}`}
        />
      </View>

      <FlatList
        style={styles.listBox}
        data={list}
        keyExtractor={(record) => record.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={14}
        maxToRenderPerBatch={14}
        windowSize={9}
        removeClippedSubviews
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <Rule />}
        ListEmptyComponent={
          <View style={{ paddingTop: space.lg, gap: space.sm }}>
            <T variant="body">Nothing matches that.</T>
            <T variant="small">Try a muscle the movement trains, or clear the chips.</T>
          </View>
        }
        ListFooterComponent={
          <T variant="micro" style={{ paddingTop: space.lg }}>
            Media © Gym visual, from the exercises-dataset collection. Duotoned to the paper and
            bundled for personal use.
          </T>
        }
        renderItem={({ item }) => {
          const thumb = catalogThumb(`cat-${item.id}`);
          return (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`${item.name}. ${equipmentLabel(item)}, ${item.target}.`}
              onPress={() => open(item)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              {thumb ? (
                <Image source={thumb} style={styles.thumb} resizeMode="contain" />
              ) : (
                <View style={styles.thumb} />
              )}
              <View style={styles.rowText}>
                <T variant="body" numberOfLines={2}>
                  {item.name}
                </T>
                <T variant="micro" numberOfLines={1}>
                  {equipmentLabel(item)} · {item.target}
                </T>
              </View>
              {item.needsRack ? (
                <T variant="chapter" style={{ color: color.rust }}>
                  RACK
                </T>
              ) : (
                <Text style={styles.arrow}>›</Text>
              )}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, gap: 0 },
  header: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.s,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderBottomWidth: 1.5,
    borderBottomColor: color.ruleStrong,
    paddingBottom: space.xs,
  },
  search: {
    flex: 1,
    paddingVertical: space.sm,
    fontFamily: sans,
    fontSize: 18,
    lineHeight: 24,
    color: color.ink,
  },
  chips: { gap: space.sm, paddingVertical: space.xs },
  chip: {
    borderWidth: 1,
    borderColor: color.rule,
    paddingHorizontal: space.s,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: color.rust, borderColor: color.rust },
  chipLabel: {
    fontFamily: mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: color.inkSoft,
  },
  chipLabelOn: { color: color.paper },
  listBox: { flex: 1 },
  list: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    paddingVertical: space.sm,
    minHeight: 68,
  },
  rowPressed: { backgroundColor: color.paperDeep },
  thumb: {
    width: 48,
    height: 48,
  },
  rowText: { flex: 1, gap: 1 },
  arrow: {
    fontFamily: serif,
    fontSize: 20,
    color: color.inkFaint,
  },
});
