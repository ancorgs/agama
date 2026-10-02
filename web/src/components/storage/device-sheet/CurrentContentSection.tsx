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
import Interpolate from "~/components/core/Interpolate";
import Text from "~/components/core/Text";
import Icon from "~/components/layout/Icon";
import SpaceDecision from "~/components/storage/storage-page/SpaceDecision";
import MenuButton, { MenuButtonItem } from "~/components/core/MenuButton";
import RowMenuToggle from "~/components/storage/entries-table/RowMenuToggle";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import { useDeletePartition } from "~/hooks/model/storage/config-model";
import { useSpacePolicy } from "~/components/storage/shared/space-policy";
import PartitionSpaceControl, {
  decisionLabel,
  decisionUnder,
} from "~/components/storage/device-sheet/PartitionSpaceControl";
import { outcomeOf } from "~/components/storage/shared/consequences";
import { useDevicesManager } from "~/components/storage/shared/use-devices-manager";
import { baseName, deviceSize } from "~/components/storage/utils";
import { _ } from "~/i18n";
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

/* The one report that costs the reader something, colored rather than marked.
   The words say what happens, and a mark beside them in a column of short
   phrases says it a second time while taking the width the phrases need. The
   color is the entries table's, so the same news reads the same in both. */
const DESTROYS_CLASS = "agm-entries-table__cost--destroys";

/**
 * How a planned action reads, and whether it loses anything.
 *
 * The words rather than a string: one report says two things at once, and the
 * half that costs the reader carries the color on its own.
 */
type Report = { text: React.ReactNode; kind: "destroys" | "shrinks" | "keeps" };

/**
 * What the installer will do to one partition the new system takes over.
 *
 * Only these rows carry a report. Every other row carries a decision instead:
 * what the reader has allowed to happen there, which is the thing they came to
 * read and the thing they can change. A partition the new system mounts is
 * spoken for, so no decision reaches it, and what becomes of it is read off the
 * plan rather than chosen.
 *
 * What it is taken over for is not said here. It is a mount point, which is a
 * value rather than news, and it has a column of its own where a reader can
 * compare one row's against the next by looking down. What it loses on the way
 * is not said here either: the content column shows the file system it had
 * struck through beside the one it gets, which is the same fact against the
 * thing it happens to.
 *
 * So it reads as kept, which is what becomes of the partition itself whether or
 * not what was on it survives. Whether it does is said in the same breath and
 * in the page's danger color, because kept on its own would have the reader
 * believe their data is safe.
 */
function reportFor(outcome: Outcome): Report {
  switch (outcome) {
    case "formatted":
      return {
        /* The row as a whole keeps its partition, so the color is on the word
           that does not, rather than on the line. */
        kind: "keeps",
        text: (
          /* One string with the costly word marked inside it, rather than two
             joined here: a translator needs the whole phrase to put the
             parenthesis where their language puts it, and some will not keep
             the word in the brackets a single word. */
          <Interpolate
            // TRANSLATORS: what the installation will do to a partition already
            // on the disk: leave it where it is, and empty it for the new
            // system. The bracketed word is the one that reads as a loss.
            sentence={_("Kept ([formatted])")}
          >
            {(text) => <span className={DESTROYS_CLASS}>{text}</span>}
          </Interpolate>
        ),
      };
    case "shrunk":
      // TRANSLATORS: what the installation will do to a partition already on
      // the disk: make it smaller, keeping what is on it.
      return { kind: "shrinks", text: _("To be shrunk") };
    /* Not something the plan can hold against a partition the new system
       mounts, and said plainly rather than as a reassuring "kept" if it ever
       is. */
    case "deleted":
      // TRANSLATORS: what the installation will do to a partition already on
      // the disk: remove it and everything on it.
      return { kind: "destroys", text: _("To be deleted") };
    case "kept":
      // TRANSLATORS: what the installation will do to a partition already on
      // the disk: leave it where it is.
      return { kind: "keeps", text: _("Kept") };
  }
}

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
  /**
   * What is allowed to happen to this partition: the word the device's rule
   * gives it, or the control that sets it where the device decides one part at
   * a time. Nothing where no decision reaches the row, and then the row says
   * what becomes of it instead.
   */
  decides?: React.ReactNode;
  /** The row's menu, where the device is one a partition can be reused from. */
  menu?: React.ReactNode;
}) {
  const outcome = outcomeOf(manager, part);
  const reusedAs = entries.find((e) => e.name === part.name)?.mountPath;
  const report = reportFor(outcome);
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
          {!newFilesystem &&
            systems.map((system) => (
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
        {/* What the reader has allowed here, in the same words whether the
            device's rule gave it or this row did. A row no decision reaches
            says what becomes of it instead. */}
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
 * since it is about the rows below it, and then again on every row it reaches,
 * since a rule set once above a list is not read again against each thing in
 * it. The same words in both places: "Delete" on the row is the device's
 * "Deleting everything" arriving here.
 *
 * Under the fourth space answer the row's word becomes the control that sets
 * it, in the same column and reading the same way, because the decision is the
 * same decision whoever makes it.
 *
 * What the installer makes of the permission is not in that column. It is a
 * permission, so "Shrink if needed" is the whole truth about a partition the
 * installer did not have to shrink; where it did, the size column says so
 * under the size it ends at.
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
              <Th modifier="nowrap">{_("Path")}</Th>
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
                         decision reaches it, by the device's rule or its own. */
                    !entries.find((e) => e.name === row.name)?.mountPath &&
                    (rule ? (
                      decisionLabel(rule)
                    ) : (
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
                    ))
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
