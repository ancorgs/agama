/*
 * Copyright (c) [2025] SUSE LLC
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

import React, { useState } from "react";
import { Alert, Content, ExpandableSection, List, ListItem } from "@patternfly/react-core";
import { _, n_, formatList } from "~/i18n";
import { useIssues } from "~/queries/issues";
import { useAvailableDevices, useConfigModel, useVolumeTemplates } from "~/queries/storage";
import { IssueSeverity } from "~/types/issues";
import * as partitionUtils from "~/components/storage/utils/partition";
import { sprintf } from "sprintf-js";
import { formattedPath } from "~/components/storage/utils";

function Description() {
  const model = useConfigModel({ suspense: true });
  const partitions = model.drives.flatMap((d) => d.partitions || []);
  const newPartitions = partitions.filter((p) => !p.name);

  if (!newPartitions.length) {
    return (
      <Content>
        {_(
          "It is not possible to install the system with the current configuration. Adjust the settings below.",
        )}
      </Content>
    );
  }

  const mountPaths = newPartitions.map((p) => partitionUtils.pathWithSize(p));
  const msg1 = sprintf(
    // TRANSLATORS: %s is a list of formatted mount points with a partition size like
    // '"/" (at least 10 GiB), "/var" (20 GiB) and "swap" (2 GiB)'
    // (or a single mount point in the singular case).
    n_(
      "It is not possible to allocate the requested partition for %s.",
      "It is not possible to allocate the requested partitions for %s.",
      mountPaths.length,
    ),
    formatList(mountPaths),
  );

  return (
    <>
      <Content>{msg1}</Content>
      <Content>
        {_("Adjust the settings below to make the new system fit into the available space.")}
      </Content>
    </>
  );
}

function snapshotsRelevant(volumes, partitions) {
  const rootOutline = volumes.find((v) => v.mountPath === "/")?.outline;
  if (!rootOutline) return false;
  if (!rootOutline.snapshotsAffectSizes || !rootOutline.snapshotsConfigurable) return false;

  const rootPartition = partitions.find((p) => p.mountPath === "/");
  if (!rootPartition) return false;

  return rootPartition.filesystem.snapshots && rootPartition.size.default;
}

function ramAffectedPaths(volumes, partitions) {
  const volumePaths = volumes.filter((v) => v.outline?.adjustByRam).map((v) => v.mountPath);
  if (!volumePaths.length) return [];

  const ramParts = partitions.filter((p) => volumePaths.includes(p.mountPath) && p.size.default);
  return ramParts.map((p) => p.mountPath);
}

function SizeExplanations() {
  const volumes = useVolumeTemplates();
  const model = useConfigModel({ suspense: true });
  const partitions = model.drives.flatMap((d) => d.partitions || []);

  const snapshots = snapshotsRelevant(volumes, partitions);
  const ramPaths = ramAffectedPaths(volumes, partitions);

  if (!snapshots && !ramPaths.length) return;

  if (snapshots && ramPaths.length === 1 && ramPaths[0] === "/") {
    return (
      <Content>
        {sprintf(
          // TRANSLATORS: %s is the formatted mount point for root, '"/"
          _(
            "Bear in mind the automatically calculated sizes of the partition for %s is influenced by the usage of Btrfs snapshots and the amount of RAM in the system.",
          ),
          formattedPath("/"),
        )}
      </Content>
    );
  }

  if (snapshots && ramPaths.length) {
    return (
      <Content>
        {sprintf(
          // TRANSLATORS: %s is the formatted mount point for root, '"/"
          _(
            "Bear in mind the automatically calculated sizes of some partitions are influenced by the amount of RAM in the system and, in the case of %s, by the usage of Btrfs snapshots.",
          ),
          formattedPath("/"),
        )}
      </Content>
    );
  }

  if (snapshots) {
    return (
      <Content>
        {sprintf(
          // TRANSLATORS: %s is the formatted mount point for root, '"/"
          _(
            "Bear in mind that using Btrfs snapshots results in a bigger auto-calculated size of the partition for %s.",
          ),
          formattedPath("/"),
        )}
      </Content>
    );
  }

  return (
    <Content>
      {sprintf(
        // TRANSLATORS: %s (used only in the singular case) is a formatted mount point like "/home"
        n_(
          "Bear in mind the automatically calculated sizes of the partition for '%s' is influenced by the amount of RAM in the system",
          "Bear in mind the automatically calculated sizes of some partitions are influenced by the amount of RAM in the system",
          ramPaths.length,
        ),
        formattedPath(ramPaths[0]),
      )}
    </Content>
  );
}

function PossibleActions() {
  // Some logic that may be needed to calculate the conditions below
  const model = useConfigModel({ suspense: true });
  const drives = model.drives;
  const drivesNames = drives.map((d) => d.name);
  const disks = useAvailableDevices();
  const diskPartitions = disks
    .filter((d) => drivesNames.includes(d.name))
    .flatMap((d) => d.partitionTable?.partitions || []);
  const drivePartitions = drives.flatMap((d) => d.partitions || []);
  const deletedDrivePartitions = drivePartitions.filter(
    (p) => p.name && (p.delete || p.deleteIfNeeded),
  );

  const actions = [];
  if (drives.length === 1 && disks.length > 1) {
    actions.push(
      _("Installing into another disk or distributing the partitions over several disks."),
    );
  }
  if (drives.length > 1) {
    actions.push(_("Changing the way the partitions are distributed on the different disks."));
  }
  if (deletedDrivePartitions.length < diskPartitions.length) {
    actions.push(
      _("Trying to find more space by configuring more partitions to be deleted or shrunk."),
    );
  }

  if (actions.length) {
    actions.push(_("Changing the partitions or adjusting its size limits."));

    return (
      <>
        <Content>{_("The list of potentially useful adjustments include:")}</Content>
        <List>
          {actions.map((action, i) => (
            <ListItem key={i}>{action}</ListItem>
          ))}
        </List>
      </>
    );
  }

  return <Content>{_("Change the partitions or adjust its size limits.")}</Content>;
}

function Hints() {
  const [isExpanded, setIsExpanded] = useState(false);

  // TODO: What to do if there are no hints?

  return (
    <ExpandableSection
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      toggleText={_("Configuration hints")}
    >
      <PossibleActions />
      <SizeExplanations />
    </ExpandableSection>
  );
}

/**
 * Information about a failed storage proposal
 *
 */
export default function ProposalFailedInfo() {
  const errors = useIssues("storage").filter((s) => s.severity === IssueSeverity.Error);

  if (!errors.length) return;

  return (
    <Alert variant="warning" title={_("Failed to calculate a storage layout")}>
      <Description />
      <Hints />
    </Alert>
  );
}
