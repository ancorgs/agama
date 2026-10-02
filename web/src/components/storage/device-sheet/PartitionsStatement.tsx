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
import PlannedContentSection from "~/components/storage/device-sheet/PlannedContentSection";
import Statement from "~/components/storage/device-sheet/Statement";
import { _ } from "~/i18n";
import type { PlannedContentSectionProps } from "~/components/storage/device-sheet/PlannedContentSection";

/**
 * What the new system will get on this entry.
 *
 * The plan rather than the outcome: what the reader asked the installer for
 * here, as against what it worked out, which the first view holds.
 *
 * What has no row to live in is said above the view rather than here, among the
 * note's statements: a fact about the device and a list of what is planned on
 * it are two kinds of thing, and a view that opens the second with the first
 * reads as content that starts twice.
 *
 * Where nothing is planned, the state says so and carries the one act that
 * changes it. An empty state and a lone button underneath it are the same offer
 * made twice. Moving the plan elsewhere is not offered here either: under a view
 * that has just said there is nothing here, moving nothing is not an act the
 * reader can want.
 */
export default function PartitionsStatement({
  entry,
  subject,
}: PlannedContentSectionProps): React.ReactNode {
  return (
    <Statement icon="list_alt" heading={_("Partitions from the following list")}>
      <PlannedContentSection entry={entry} subject={subject} />
    </Statement>
  );
}
