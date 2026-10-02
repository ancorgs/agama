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
import { Divider, Stack, StackItem } from "@patternfly/react-core";
import PlannedContentSection from "~/components/storage/device-sheet/PlannedContentSection";
import PartitionsStatement from "~/components/storage/device-sheet/PartitionsStatement";
import CurrentContentSection, {
  hasCurrentContent,
} from "~/components/storage/device-sheet/CurrentContentSection";
import TabNote from "~/components/storage/device-sheet/TabNote";
import UsedByStatement from "~/components/storage/device-sheet/UsedByStatement";
import BootStatement from "~/components/storage/device-sheet/BootStatement";
import { _ } from "~/i18n";
import type { Entry } from "~/components/storage/device-sheet/entry";
import type { SheetEntry } from "~/components/storage/shared/use-sheet";

export type DeviceDetailProps = {
  entry: Entry;
  /** Where the entry is written, which is what the acts on its parts need. */
  subject: SheetEntry;
};

/**
 * What one entry of the plan holds, read top to bottom as time moving forwards.
 *
 * Two blocks, one under the other: what the new system gets here, and then what
 * is on the device today and what becomes of it. They were a strip of tabs, and
 * reading them together is what the panel is for. The second block is about
 * making room for the first, so a reader who has to change it was being asked to
 * leave the thing it is about to see the thing that decides it; and a reader who
 * only came to check was being asked to click to find out whether there was
 * anything to check at all.
 *
 * Nothing in the words says partition or volume: the same panel serves a disk, a
 * RAID and a volume group, and what each holds goes by a different word.
 *
 * Neither block carries a heading of its own. Each opens on a sentence saying
 * what it holds, and the table under it is named the same thing, so a title
 * above both would say it a third time.
 */
export default function DeviceDetail({ entry, subject }: DeviceDetailProps): React.ReactNode {
  /* Only where the machine has something on the entry today. On an empty disk,
     or a volume group being defined, the whole answer is that there is nothing,
     and a block saying so costs a rule across the panel and a sentence to
     report an absence the reader did not cause. */
  const hasCurrent = hasCurrentContent(entry);

  /* Whole sentences per kind of entry: an article and a noun agree in most
     languages, and a slot taking either "disk" or "volume group" would leave a
     translator unable to make them. */
  const isRaid = subject.collection === "mdRaids";
  const plannedLead = () => {
    // FIXME: For disks with existing partitions or VGs with existing LVs, we should say "created or
    // reused" and for the rest only "created".
    if (entry.isVolumeGroup)
      return _("Pieces of the new system that will be created in this volume group.");
    // TRANSLATORS: opens the part of the panel showing what a software RAID will hold.
    if (isRaid) return _("Pieces of the new system that will be created or reused in this RAID.");
    // TRANSLATORS: opens the part of the panel showing what a disk will hold.
    return _("Pieces of the new system that will be created or reused in this disk.");
  };

  return (
    <Stack hasGutter>
      <StackItem>
        <TabNote lead={plannedLead()} />
        <BootStatement entry={entry} />
        <UsedByStatement entry={entry} />
        {entry.isVolumeGroup && <PlannedContentSection entry={entry} subject={subject} />}
        {!entry.isVolumeGroup && <PartitionsStatement entry={entry} subject={subject} />}
      </StackItem>
      {/* Only where the machine has something on the entry today. */}
      {hasCurrent && (
        <>
          <StackItem>
            {/* The one rule across the whole panel. The blocks are two subjects
                rather than two parts of one, and the gap between them says that
                less plainly the further the first block runs. */}
            <Divider />
          </StackItem>
          <StackItem>
            <TabNote
              // FIXME: we need the LVM alternative here
              lead={_(
                "What to do with the existing partitions to make space for the planned ones.",
              )}
            />
            <CurrentContentSection entry={entry} subject={subject} />
          </StackItem>
        </>
      )}
    </Stack>
  );
}
