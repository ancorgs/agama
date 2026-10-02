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
import { Stack, StackItem } from "@patternfly/react-core";
import PlannedContentSection from "~/components/storage/device-sheet/PlannedContentSection";
import PlannedPartitionsSection from "~/components/storage/device-sheet/PlannedPartitionsSection";
import CurrentContentSection, {
  hasCurrentContent,
} from "~/components/storage/device-sheet/CurrentContentSection";
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

  return (
    <Stack hasGutter>
      {/* Only where the machine has something on the entry today. */}
      {hasCurrent && (
        <>
          <StackItem>
            <CurrentContentSection entry={entry} subject={subject} />
          </StackItem>
        </>
      )}
      <StackItem>
        {entry.isVolumeGroup && <PlannedContentSection entry={entry} subject={subject} />}
        {!entry.isVolumeGroup && <PlannedPartitionsSection entry={entry} subject={subject} />}
      </StackItem>
    </Stack>
  );
}
