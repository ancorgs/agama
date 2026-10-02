/*
 * Copyright (c) [2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React from "react";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import { Divider, Flex, FlexItem, Label, Stack, StackItem } from "@patternfly/react-core";
import alignmentStyles from "@patternfly/react-styles/css/utilities/Alignment/alignment";
import { sprintf } from "sprintf-js";
import Text from "~/components/core/Text";
import Icon from "~/components/layout/Icon";
import SpaceDecision from "~/components/storage/storage-page/SpaceDecision";
import MenuButton, { MenuButtonItem } from "~/components/core/MenuButton";
import RowMenuToggle from "~/components/storage/entries-table/RowMenuToggle";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import { useDeletePartition } from "~/hooks/model/storage/config-model";
import { useSpacePolicy } from "~/components/storage/shared/space-policy";
import {
  decisionOf,
  decisionUnder,
  usePartitionSpaceItems,
} from "~/components/storage/device-sheet/partition-space";
import { outcomeOf } from "~/components/storage/shared/consequences";
import { useDevicesManager } from "~/components/storage/shared/use-devices-manager";
import { baseName, deviceSize, formattedPath } from "~/components/storage/utils";
import { _ } from "~/i18n";
import type DevicesManager from "~/model/storage/devices-manager";
import type { Decision } from "~/components/storage/device-sheet/partition-space";
import type { ConfigModel, DeviceCollection, Partitionable } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-sheet/entry";
import type { SheetEntry } from "~/components/storage/shared/use-sheet";
import type { Storage as System } from "~/model/system";

type FreeSpace = System.UnusedSlot;
type Row = System.Device | FreeSpace;

const isFreeSpace = (row: Row): row is FreeSpace => !("sid" in row);

/**
 * What is on the device today, in the order it sits there, free space included.
 *
 * Free space is a row: "keep everything" is a choice with no visible evidence
 * behind it otherwise.
 */
function rowsOf(entry: Entry): Row[] {
  const device = entry.device;
  if (!device) return [];
  if (entry.isVolumeGroup) return device.logicalVolumes || [];

  const parts: [number, Row][] = (device.partitions || []).map((p) => [p.block?.start || 0, p]);
  const free: [number, Row][] = (device.partitionTable?.unusedSlots || []).map((s) => [s.start, s]);

  return [...parts, ...free].sort((a, b) => a[0] - b[0]).map(([, row]) => row);
}

/**
 * Whether this entry has anything on it today, which is whether the view has
 * anything to say.
 *
 * Asked by whoever offers the view rather than answered inside it. A view whose
 * whole answer is that there is nothing costs a reader a click to learn
 * nothing, and an empty disk or a volume group being defined would carry one.
 */
export function hasCurrentContent(entry: Entry): boolean {
  return rowsOf(entry).length > 0;
}

/**
 * Everything that can be told to one thing already on the device, in one place.
 *
 * Two kinds of thing, and the reader has no reason to know they are two. What
 * the installation may do to a partition is a space decision, answered for the
 * whole device unless the reader asked to answer it part by part; whether the
 * new system takes the partition over is not a space decision at all, and stays
 * offered whatever the space answer is. They used to sit in different columns
 * for that reason, which left a row with two ways in and the reader to find out
 * which held what. A rule between them is enough to keep them apart.
 *
 * Nothing where there is nothing to offer: a volume group's logical volumes
 * cannot be reused, and a device following a rule of its own has no per-part
 * decision to make here.
 */
function PartitionMenu({
  part,
  reusedAs,
  decidesHere,
  governed,
  entries,
  collection,
  index,
}: {
  part: System.Device;
  /** Where the new system mounts it already, where it does. */
  reusedAs?: string;
  /** Whether this row is where its own space decision is made. */
  decidesHere: boolean;
  /** Every partition that decision governs, which it is written back with. */
  governed: System.Device[];
  entries: (ConfigModel.Partition | ConfigModel.LogicalVolume)[];
  collection: DeviceCollection;
  index: number;
}) {
  const deletePartition = useDeletePartition();
  const name = baseName(part.name);
  // TRANSLATORS: names the menu of things that can be done to one partition
  // already on a device. %s is its name, such as "vda2".
  const menuLabel = sprintf(_("Actions for %s"), name);
  const at = { collection, index: String(index) };
  /* Asked for on every row, since a hook cannot be asked for on some of them,
     and used only where the row is the one deciding. */
  const spaceItems = usePartitionSpaceItems({
    partition: part,
    governed,
    entries,
    collection,
    index,
  });

  /* Only off a device whose partitions the new system can take over. A group's
     logical volumes are not among them. */
  const reuseItems =
    collection === "volumeGroups"
      ? []
      : reusedAs
        ? [
            <MenuButtonItem
              key="edit"
              to={generateEncodedPath(PATHS.editPartition, { ...at, partitionId: reusedAs })}
              keepQuery
            >
              {/* TRANSLATORS: offered on a partition the new system already
                  reuses: change how it is used. */}
              {_("Edit the reused partition")}
            </MenuButtonItem>,
            <MenuButtonItem key="stop" onClick={() => deletePartition(collection, index, reusedAs)}>
              {/* TRANSLATORS: offered on a partition the new system reuses: stop
                  using it, which leaves it to the device's space decision again. */}
              {_("Stop reusing")}
            </MenuButtonItem>,
          ]
        : [
            <MenuButtonItem
              key="reuse"
              to={generateEncodedPath(PATHS.reusePartition, { ...at, deviceName: part.name })}
              keepQuery
            >
              {/* TRANSLATORS: offered on a partition already on a device: use it
                  for the new system. The ellipsis says a form follows. */}
              {_("Reuse for the new system…")}
            </MenuButtonItem>,
          ];

  /* The space decision first: it is what the row's first column says about
     itself, so the menu opens on the thing the reader just read. */
  const decisions = decidesHere ? spaceItems : [];
  const items = [
    ...decisions,
    ...(decisions.length && reuseItems.length ? [<Divider key="rule" component="li" />] : []),
    ...reuseItems,
  ];

  if (!items.length) return null;

  return (
    <MenuButton
      menuProps={{ "aria-label": menuLabel, popperProps: { position: "end" } }}
      customToggle={<RowMenuToggle label={menuLabel} />}
      items={items}
    />
  );
}

/* The one report that costs the reader something, colored rather than marked.
   The words say what happens, and a mark beside them in a column of short
   phrases says it a second time while taking the width the phrases need. The
   color is the entries table's, so the same news reads the same in both. */
const DESTROYS_CLASS = "agm-entries-table__cost--destroys";

/**
 * What is to become of one thing already on the device, and whether that costs
 * the reader anything.
 *
 * The words rather than a string: half the statuses are a loss and carry the
 * color saying so, and half are not.
 */
type Status = { text: string; destroys: boolean };

/**
 * What is to become of one thing already on the device, said beside its name.
 *
 * Two questions answered in one phrase, because a reader looking at a row wants
 * one answer about it. Where the new system takes the partition over, that is
 * the answer and no space decision reaches it: it is spoken for, and what it is
 * taken over for is the useful half of the news, so the phrase carries the
 * mount point rather than making the reader find it. Where the new system has
 * no use for it, the answer is what the reader has allowed to happen there.
 *
 * Lower case and tucked in after the name: it is the end of a phrase the name
 * begins, not a heading, and a column of them is read down.
 *
 * Taking a partition over still empties it more often than not, and "mount at"
 * where the installation means to format would have a reader believe their data
 * is safe. So the two are different phrases, and the one that loses something
 * says so and is colored.
 */
function statusFor(
  decision: Decision | undefined,
  reusedAs: string | undefined,
  formatted: boolean,
): Status | undefined {
  if (reusedAs) {
    const path = formattedPath(reusedAs);

    return formatted
      ? // TRANSLATORS: what is to become of a partition already on the disk: it
        // is emptied and given to the new system. %s is where the new system
        // mounts it, such as "/home".
        { text: sprintf(_("format for %s"), path), destroys: true }
      : // TRANSLATORS: what is to become of a partition already on the disk: the
        // new system takes it over as it is. %s is where the new system mounts
        // it, such as "/home".
        { text: sprintf(_("mount at %s"), path), destroys: false };
  }

  switch (decision) {
    case "keep":
      // TRANSLATORS: what is to become of a partition already on the disk:
      // nothing.
      return { text: _("keep"), destroys: false };
    case "resizeIfNeeded":
      // TRANSLATORS: what is to become of a partition already on the disk: it
      // may be made smaller, should the installation run short of room.
      return { text: _("shrink if needed"), destroys: false };
    case "delete":
      // TRANSLATORS: what is to become of a partition already on the disk: it
      // is removed, and everything on it lost.
      return { text: _("delete"), destroys: true };
    default:
      return undefined;
  }
}

/**
 * What is allowed to happen to one thing already on the device.
 *
 * The device's rule where it has one to give, and the thing's own where the
 * fourth answer leaves it to the parts. Nothing at all where the new system
 * mounts it: it is spoken for, and no space decision reaches it.
 */
function decisionFor(
  rule: Decision | undefined,
  entry?: ConfigModel.Partition | ConfigModel.LogicalVolume,
): Decision | undefined {
  if (entry?.mountPath) return undefined;
  return rule || decisionOf(entry);
}

function PartitionRow({
  part,
  manager,
  entries,
  decision,
  menu,
}: {
  part: System.Device;
  manager: DevicesManager;
  entries: (ConfigModel.Partition | ConfigModel.LogicalVolume)[];
  /** What is allowed to happen here, however it came to be allowed. */
  decision?: Decision;
  /** The row's menu, where there is anything to offer on this row. */
  menu?: React.ReactNode;
}) {
  const outcome = outcomeOf(manager, part);
  const reusedAs = entries.find((e) => e.name === part.name)?.mountPath;
  const systems = part.block?.systems || [];
  const size = part.block?.size;
  const staged = manager.stagingDevice(part.sid);
  const shrunkTo = outcome === "shrunk" ? staged?.block?.size : undefined;
  /* What the partition is left holding, where that is not what it holds today.
     Read from the plan rather than from the request, since the request can
     leave the file system to the installer and the plan cannot. */
  const newFilesystem = outcome === "formatted" ? staged?.filesystem?.type : undefined;
  const currentContent =
    part.filesystem?.type ||
    part.description ||
    // TRANSLATORS: said of a partition whose content is not recognized.
    _("unrecognized");
  const status = statusFor(decision, reusedAs, newFilesystem !== undefined);

  /* A rule through what the row describes, where the reader has allowed it to
     go. The name, what is on it and how big it is are facts about a partition
     that will not be there afterwards. Not through the status that says so:
     crossing out "delete" says the opposite of what it means. */
  const struck = (content: React.ReactNode) =>
    decision === "delete" ? (
      <s>
        <Text textStyle="textColorSubtle">{content}</Text>
      </s>
    ) : (
      content
    );

  return (
    <Tr>
      {/* The name, and then what is to become of it. One phrase rather than a
          name here and a verdict in a column of its own: the verdict is about
          this partition and nothing else, so the reader should not have to
          cross the row to collect it, nor keep the name in mind on the way. */}
      <Th scope="row" modifier="nowrap">
        {struck(
          <>
            <Text isBold>{baseName(part.name)}</Text>
            {part.block?.encrypted && (
              <>
                {" "}
                {/* TRANSLATORS: marks a partition whose content is encrypted. */}
                <Icon name="lock" size="xs" aria-label={_("encrypted")} />
              </>
            )}
          </>,
        )}
        {status && (
          <>
            {" "}
            <span className={status.destroys ? DESTROYS_CLASS : undefined}>{status.text}</span>
          </>
        )}
      </Th>
      {/* What is on it. What becomes of the partition is said beside its name,
          so it is not said here too. A system the machine reports sits beside
          the file system as a mark: naming Windows is what makes a deletion
          mean something.

          Where the installation empties it, what it holds today is struck
          through beside what it is given, so the loss reads against the thing
          lost rather than as a verb in another column. */}
      <Td>
        <Flex gap={{ default: "gapXs" }} alignItems={{ default: "alignItemsCenter" }}>
          <FlexItem>
            {newFilesystem ? (
              /* Struck through and subdued rather than colored: the rule
                 through it already says it goes, and a word in the page's
                 danger color beside the one replacing it would make the loss
                 louder than the thing the reader asked for. */
              <s>
                <Text textStyle="textColorSubtle">{currentContent}</Text>
              </s>
            ) : (
              struck(currentContent)
            )}
          </FlexItem>
          {newFilesystem && <FlexItem>{newFilesystem}</FlexItem>}
          {/* The system left standing on a row being deleted. It is a mark
              rather than a word in the sentence, so a rule through it would be
              a rule through a label; and it is the one thing on the row that
              makes the deletion mean something, which is not helped by being
              crossed out. */}
          {!newFilesystem &&
            systems.map((system) => (
              <FlexItem key={system}>
                <Label isCompact>{system}</Label>
              </FlexItem>
            ))}
        </Flex>
      </Td>
      <Td className={alignmentStyles.textAlignEnd}>
        {shrunkTo !== undefined ? (
          <div>{deviceSize(size)}</div>
        ) : (
          size !== undefined && struck(deviceSize(size))
        )}
      </Td>
      <Td isActionCell>{menu}</Td>
    </Tr>
  );
}

export type CurrentContentSectionProps = {
  entry: Entry;
  /** Where the entry is written, which is what the space decision acts on. */
  subject: SheetEntry;
};

/**
 * What is on the device today, and what the installation will do to it.
 *
 * The one view where a reader can see the whole answer partition by partition
 * rather than as a summary. The decision reads above the table it governs,
 * since it is about the rows below it, and then again on every row it reaches,
 * since a rule set once above a list is not read again against each thing in
 * it. The same decision in both places: "delete" on the row is the device's
 * "Deleting everything" arriving here.
 *
 * Each row says it after the name of the thing it is about, so the three
 * columns left are three facts about the partition and the name carries the
 * verdict on it. A column of verdicts across the table had the reader reading
 * each row twice, once to find which partition and once to find what happens
 * to it, and left two of its five columns empty on most rows.
 *
 * Changing the verdict is in the row's menu, with everything else the row can
 * be told to do, and only under the fourth space answer, which is the answer
 * that says the parts decide. Under the other three the decision belongs to
 * the device and is made above the table.
 *
 * It is a permission rather than a plan: "shrink if needed" is the whole truth
 * about a partition the installer did not have to shrink.
 *
 * A row allowed to go is struck through where it describes itself, so the loss
 * is read off the row rather than off one word in it. Not the verdict, which
 * is the thing the reader chose and the one part of the row still true
 * afterwards.
 *
 * Shown only where there is something to show, which whoever offers the view
 * settles with {@link hasCurrentContent}. The view never has to say that it has
 * nothing to say.
 */
export default function CurrentContentSection({
  entry,
  subject,
}: CurrentContentSectionProps): React.ReactNode {
  const manager = useDevicesManager();
  const rows = rowsOf(entry);
  /* Asked for rather than read off the entry: custom with nothing decided yet
     is written down as keeping everything, so the entry cannot report it. */
  const { policy } = useSpacePolicy(subject.collection, subject.index, entry.config.spacePolicy);
  /* What the device's own rule allows each of its partitions, where it has one
     to give. Nothing under the fourth answer, which is the answer that says the
     parts decide, and then each row carries the control that decides it. */
  const rule = decisionUnder(policy);
  const entries = entry.isVolumeGroup
    ? (entry.config as ConfigModel.VolumeGroup).logicalVolumes || []
    : (entry.config as Partitionable.Device).partitions || [];
  /* Everything one per-partition decision is written back with. One the new
     system mounts is not among them: it is spoken for, and the configuration
     holds what it is used for rather than what may be done to it. */
  const governed = rows.filter(
    (row): row is System.Device =>
      !isFreeSpace(row) && !entries.find((e) => e.name === row.name)?.mountPath,
  );

  return (
    <Stack hasGutter>
      {/* Only where there is something for the rule to be about. A group's
          logical volumes are governed the same way its disks' partitions are,
          so the decision is offered there too. */}
      {rows.some((row) => !isFreeSpace(row)) && (
        <StackItem>
          <Flex>
            <FlexItem>{_("Some text")}</FlexItem>
            <FlexItem align={{ default: "alignRight" }}>
              <SpaceDecision collection={subject.collection} index={subject.index} isAssertive />
            </FlexItem>
          </Flex>
        </StackItem>
      )}
      <StackItem>
        <Table
          role="table"
          gridBreakPoint=""
          variant="compact"
          // TRANSLATORS: names the list of what is on a device already.
          aria-label={_("Current content")}
        >
          {/* Read rather than hidden from sight: what a column holds is told
                by what it is called, and a reader left to work that out from
                the values is being asked to do the heading's job.

                Each heading kept whole. PatternFly cuts one down to whatever
                its column came out as, which shortens the one thing on the row
                whose whole job is to be read. */}
          <Thead>
            <Tr>
              {/* Named for what the column is a list of, not for everything it
                  says. What is to become of each one rides after its name
                  rather than in a column of its own, and a heading naming both
                  would be a sentence where a name goes. */}
              <Th modifier="nowrap">{_("Partition")}</Th>
              <Th modifier="nowrap">{_("Content")}</Th>
              <Th className={alignmentStyles.textAlignEnd} modifier="nowrap">
                {_("Size")}
              </Th>
              <Th>
                {/* The column of menus has nothing to head: a heading over it
                      names a column the reader can already see the point of. */}
                <Text srOnly>{_("Options")}</Text>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((row, at) => {
              if (isFreeSpace(row)) {
                return (
                  <Tr key={`free-${at}`}>
                    <Th scope="row">
                      <Text textStyle="textColorSubtle">
                        {/* TRANSLATORS: a row for room on a device that no
                            partition takes. */}
                        {_("Free space")}
                      </Text>
                    </Th>
                    <Td />
                    <Td className={alignmentStyles.textAlignEnd}>{deviceSize(row.size)}</Td>
                    <Td />
                  </Tr>
                );
              }

              /* Worked out once and given to the row, which says it beside the
                 name, reads the rest of itself against it, and offers to have
                 it changed. */
              const decision = decisionFor(
                rule,
                entries.find((e) => e.name === row.name),
              );

              return (
                <PartitionRow
                  key={row.sid}
                  part={row}
                  manager={manager}
                  entries={entries}
                  decision={decision}
                  menu={
                    <PartitionMenu
                      part={row}
                      reusedAs={entries.find((e) => e.name === row.name)?.mountPath}
                      /* Where the device gives no rule of its own, and the row
                         is not spoken for by the new system. */
                      decidesHere={decision !== undefined && rule === undefined}
                      governed={governed}
                      entries={entries}
                      collection={subject.collection}
                      index={subject.index}
                    />
                  }
                />
              );
            })}
          </Tbody>
        </Table>
      </StackItem>
    </Stack>
  );
}
