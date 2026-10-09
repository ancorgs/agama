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
import { Stack, EmptyState, EmptyStateBody } from "@patternfly/react-core";
import Text from "~/components/core/Text";
import type { DeviceDetailProps } from "~/components/storage/device-sheet/DeviceDetail";
import { _ } from "~/i18n";

export default function VolumeGroupContent({ entry, subject }: DeviceDetailProps): React.ReactNode {
  console.log("e", entry, "s", subject);
  return (
    <Stack>
      <Text isBold>{_("TODO")}</Text>
      <EmptyState
        headingLevel="h3"
        variant="sm"
        titleText={_("This EmptyState should offer both formatting and partitioning")}
      >
        <EmptyStateBody>
          {_("Format, add a partition or reuse one of the partitions already in the disk.")}
        </EmptyStateBody>
      </EmptyState>
    </Stack>
  );
}
