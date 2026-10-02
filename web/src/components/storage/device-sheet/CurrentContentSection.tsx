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
import { Flex, FlexItem, Label, Stack, StackItem } from "@patternfly/react-core";
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
import PartitionSpaceControl from "~/components/storage/device-sheet/PartitionSpaceControl";
import { outcomeOf } from "~/components/storage/shared/consequences";
import { useDevicesManager } from "~/components/storage/shared/use-devices-manager";
import { baseName, deviceSize } from "~/components/storage/utils";
import { _, TranslatedString } from "~/i18n";
import type DevicesManager from "~/model/storage/devices-manager";
import type { Outcome } from "~/components/storage/shared/consequences";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
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
 * What can be done to one partition that is already on the device.
 *
 * Reusing a partition is not a space decision: it is about what the new system
 * mounts, and it stays offered whatever the device's space answer is. That is
 * why it lives in the row's menu rather than in the control beside it.
 */
function PartitionMenu({
  part,
  reusedAs,
  collection,
  index,
}: {
  part: System.Device;
  /** Where the new system mounts it already, where it does. */
  reusedAs?: string;
  collection: "drives" | "mdRaids";
  index: number;
}) {
  const deletePartition = useDeletePartition();
  const name = baseName(part.name);
  // TRANSLATORS: names the menu of things that can be done to one partition
  // already on a device. %s is its name, such as "vda2".
  const menuLabel = sprintf(_("Actions for %s"), name);
  const at = { collection, index: String(index) };

  const items = reusedAs
    ? [
        <MenuButtonItem
          key="edit"
          to={generateEncodedPath(PATHS.editPartition, { ...at, partitionId: reusedAs })}
          keepQuery
        >
          {/* TRANSLATORS: offered on a partition the new system already reuses:
              change how it is used. */}
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
          {/* TRANSLATORS: offered on a partition already on a device: use it for
              the new system. The ellipsis says a form follows. */}
          {_("Reuse for the new system…")}
        </MenuButtonItem>,
      ];

  return (
    <MenuButton
      menuProps={{ "aria-label": menuLabel, popperProps: { position: "end" } }}
      customToggle={<RowMenuToggle label={menuLabel} />}
      items={items}
    />
  );
}

/** How a planned action reads, and whether it loses anything. */
type Report = { text: TranslatedString; kind: "destroys" | "shrinks" | "keeps" };

/**
 * What the installer will do to one partition, in words a reader can check
 * against what they meant.
 *
 * In the future tense, because nothing has happened yet, and the column is the
 * last place to suggest otherwise.
 *
 * What a partition is taken over for is not said here. It is a mount point,
 * which is a value rather than news, and it has a column of its own where a
 * reader can compare one row's against the next by looking down. What it loses
 * on the way is not said here either: the content column shows the file system
 * it had struck through beside the one it gets, which is the same fact against
 * the thing it happens to.
 *
 * So a partition the new system takes over reads as kept, which is what becomes
 * of the partition itself whether or not what was on it survives. A shrink is
 * the one thing still worth saying over the top of that: nothing else on the
 * row says the partition is not the one it was.
 */
function reportFor(outcome: Outcome, isReused: boolean): Report {
  if (isReused && outcome !== "shrunk") {
    // TRANSLATORS: what the installation will do to a partition already on the
    // disk: leave it where it is.
    return { kind: "keeps", text: _("Kept") };
  }

  switch (outcome) {
    case "deleted":
      // TRANSLATORS: what the installation will do to a partition already on
      // the disk: remove it and everything on it.
      return { kind: "destroys", text: _("To be deleted") };
    case "formatted":
      // TRANSLATORS: what the installation will do to a partition already on
      // the disk: empty it.
      return { kind: "destroys", text: _("To be formatted") };
    case "shrunk":
      // TRANSLATORS: what the installation will do to a partition already on
      // the disk: make it smaller, keeping what is on it.
      return { kind: "shrinks", text: _("To be shrunk") };
    case "kept":
      // TRANSLATORS: what the installation will do to a partition already on
      // the disk: nothing.
      return { kind: "keeps", text: _("Kept") };
  }
}

/* The one report that costs the reader something, colored rather than marked.
   The words say what happens, and a mark beside them in a column of short
   phrases says it a second time while taking the width the phrases need. The
   color is the entries table's, so the same news reads the same in both. */
const DESTROYS_CLASS = "agm-entries-table__cost--destroys";

function PartitionRow({
  part,
  manager,
  entries,
  decides,
  menu,
}: {
  part: System.Device;
  manager: DevicesManager;
  entries: (ConfigModel.Partition | ConfigModel.LogicalVolume)[];
  /** The control deciding this row, where the device decides one at a time. */
  decides?: React.ReactNode;
  /** The row's menu, where the device is one a partition can be reused from. */
  menu?: React.ReactNode;
}) {
  const outcome = outcomeOf(manager, part);
  const reusedAs = entries.find((e) => e.name === part.name)?.mountPath;
  const report = reportFor(outcome, Boolean(reusedAs));
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

  return (
    <Tr>
      <Th scope="row">
        <Text isBold>{baseName(part.name)}</Text>
        {part.block?.encrypted && (
          <>
            {" "}
            {/* TRANSLATORS: marks a partition whose content is encrypted. */}
            <Icon name="lock" size="xs" aria-label={_("encrypted")} />
          </>
        )}
      </Th>
      {/* Where the new system takes it over, and nothing where it does not. A
          mount point is what the partition is kept for, and a column of them
          is read down the table rather than out of a sentence per row, which
          is why it is not folded into what becomes of the partition.

          The path bare rather than quoted: quotation marks hold a path apart
          from the words around it, and a column of paths has no words around
          it to be held apart from. */}
      <Td>{reusedAs}</Td>
      {/* What is on it. What becomes of the partition is two columns on, so it
          is not said here too. A system the machine reports sits beside the
          file system as a mark: naming Windows is what makes a deletion mean
          something.

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
              currentContent
            )}
          </FlexItem>
          {newFilesystem && <FlexItem>{newFilesystem}</FlexItem>}
          {systems.map((system) => (
            <FlexItem key={system}>
              <Label isCompact>{system}</Label>
            </FlexItem>
          ))}
        </Flex>
      </Td>
      {/* The size it ends at where a shrink is planned, with the size it has
          today under it: the change beside the value it changes. On the same
          edge as every other size, so a column of them is compared by looking
          down rather than by reading each one. */}
      <Td className={alignmentStyles.textAlignEnd}>
        {shrunkTo !== undefined ? (
          <>
            <div>{deviceSize(shrunkTo)}</div>
            {size !== undefined && (
              <div className="agm-row-note">
                {sprintf(
                  // TRANSLATORS: under the size a partition ends up with. %s is
                  // the size it has today, such as "3 GiB".
                  _("Shrunk from %s"),
                  deviceSize(size),
                )}
              </div>
            )}
          </>
        ) : (
          size !== undefined && deviceSize(size)
        )}
      </Td>
      <Td>
        {/* Reading and deciding share the column: under the fourth space answer
            the row carries its decision, and what the installer makes of it
            reads under the control that set it. */}
        {decides && <div>{decides}</div>}
        {!decides &&
          (report.kind === "destroys" ? (
            <span className={DESTROYS_CLASS}>{report.text}</span>
          ) : (
            report.text
          ))}
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
 * since it is about the rows below it; and it is a permission rather than an
 * instruction, which is why a column says what the installer will actually do.
 *
 * Under the fourth space answer each partition carries its own decision, in the
 * column that reports what the installer does with it.
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
  const isCustom = policy === "custom";
  const entries = entry.isVolumeGroup
    ? (entry.config as ConfigModel.VolumeGroup).logicalVolumes || []
    : (entry.config as Partitionable.Device).partitions || [];

  return (
    <Stack hasGutter>
      {/* Only where there is something for the rule to be about. A group's
          logical volumes are governed the same way its disks' partitions are,
          so the decision is offered there too. */}
      {rows.some((row) => !isFreeSpace(row)) && (
        <StackItem>
          <SpaceDecision collection={subject.collection} index={subject.index} isAssertive />
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
              <Th modifier="nowrap">{_("Partition")}</Th>
              {/* TRANSLATORS: names the column saying where the new system
                  mounts a partition it takes over. */}
              <Th modifier="nowrap">{_("Mount point")}</Th>
              <Th modifier="nowrap">{_("Content")}</Th>
              <Th className={alignmentStyles.textAlignEnd} modifier="nowrap">
                {_("Size")}
              </Th>
              {/* One word, and the page's own. "Action" rather than "What
                    happens": nothing has happened yet, and a heading is a name
                    for a column rather than a sentence about it. */}
              <Th modifier="nowrap">{_("Action")}</Th>
              <Th>
                {/* The column of menus has nothing to head: a heading over it
                      names a column the reader can already see the point of.
                      "Options" rather than "Actions", which the column beside
                      it has just spent on what the installer does. */}
                <Text srOnly>{_("Options")}</Text>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((row, at) =>
              isFreeSpace(row) ? (
                <Tr key={`free-${at}`}>
                  <Th scope="row">
                    <Text textStyle="textColorSubtle">
                      {/* TRANSLATORS: a row for room on a device that no
                            partition takes. */}
                      {_("Free space")}
                    </Text>
                  </Th>
                  <Td />
                  <Td />
                  <Td className={alignmentStyles.textAlignEnd}>{deviceSize(row.size)}</Td>
                  <Td />
                  <Td />
                </Tr>
              ) : (
                <PartitionRow
                  key={row.sid}
                  part={row}
                  manager={manager}
                  entries={entries}
                  menu={
                    subject.collection !== "volumeGroups" && (
                      <PartitionMenu
                        part={row}
                        reusedAs={entries.find((e) => e.name === row.name)?.mountPath}
                        collection={subject.collection}
                        index={subject.index}
                      />
                    )
                  }
                  decides={
                    /* One the new system mounts is spoken for, so no space
                         decision reaches it. */
                    isCustom &&
                    !entries.find((e) => e.name === row.name)?.mountPath && (
                      <PartitionSpaceControl
                        partition={row}
                        governed={rows.filter(
                          (candidate): candidate is System.Device =>
                            !isFreeSpace(candidate) &&
                            !entries.find((e) => e.name === candidate.name)?.mountPath,
                        )}
                        entries={entries}
                        collection={subject.collection}
                        index={subject.index}
                      />
                    )
                  }
                />
              ),
            )}
          </Tbody>
        </Table>
      </StackItem>
    </Stack>
  );
}
