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
import { Dropdown, DropdownItem, DropdownList, MenuToggle } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";
import { baseName } from "~/components/storage/utils";
import { useSetSpacePolicy } from "~/hooks/model/storage/config-model";
import { _, TranslatedString } from "~/i18n";
import type { ConfigModel, DeviceCollection } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";

/** What the installer may do to one partition, as the configuration can say it. */
type Decision = "keep" | "resizeIfNeeded" | "delete";

/**
 * The three decisions a partition can carry.
 *
 * An explicit size to shrink to and a conditional delete are states the
 * configuration can hold, and they are still read elsewhere; neither is offered
 * here, because neither is a decision the reader can make anywhere else either.
 */
const DECISIONS: Decision[] = ["keep", "resizeIfNeeded", "delete"];

/**
 * What a device's own rule allows each of its partitions, where the rule is one
 * for the whole device.
 *
 * The three answers are the same three a partition can carry on its own, said
 * once for every part rather than part by part. Custom has no answer here: it
 * is the answer that says there is none for the device, and each part gives its
 * own.
 */
function decisionUnder(policy: ConfigModel.SpacePolicy): Decision | undefined {
  switch (policy) {
    case "delete":
      return "delete";
    case "resize":
      return "resizeIfNeeded";
    case "keep":
      return "keep";
    case "custom":
      return undefined;
  }
}

/**
 * The word for one decision, wherever it is read.
 *
 * The same word whether the reader set it on this partition or on the device
 * above it: a column mixing "Delete" with "To be deleted" would have a reader
 * work out that the two are one thing.
 */
function decisionLabel(decision: Decision): TranslatedString {
  switch (decision) {
    case "keep":
      // TRANSLATORS: what the installer may do to one partition: nothing.
      return _("Keep");
    case "resizeIfNeeded":
      // TRANSLATORS: what the installer may do to one partition: make it
      // smaller, only if it runs short of room.
      return _("Shrink if needed");
    case "delete":
      // TRANSLATORS: what the installer may do to one partition: remove it.
      return _("Delete");
  }
}

function meaning(decision: Decision): TranslatedString {
  switch (decision) {
    case "keep":
      // TRANSLATORS: explains keeping one partition.
      return _("Left as it is.");
    case "resizeIfNeeded":
      // TRANSLATORS: explains allowing one partition to be made smaller.
      return _("Resized only if space runs short.");
    case "delete":
      // TRANSLATORS: explains deleting one partition.
      return _("Removed, and its data lost.");
  }
}

/** The decision a partition carries today, read from its configuration entry. */
function decisionOf(entry?: ConfigModel.Partition | ConfigModel.LogicalVolume): Decision {
  if (entry?.delete) return "delete";
  if (entry?.resizeIfNeeded) return "resizeIfNeeded";
  return "keep";
}

export type PartitionSpaceControlProps = {
  /** The partition this decides about, as the machine reports it. */
  partition: System.Device;
  /** Every partition the decision governs on this device, in the same terms. */
  governed: System.Device[];
  /** The device's configuration entries, which carry the decisions made so far. */
  entries: (ConfigModel.Partition | ConfigModel.LogicalVolume)[];
  /** Where the entry is written. */
  collection: DeviceCollection;
  index: number;
};

/**
 * What the installer may do to one partition, or to one logical volume, where
 * that is decided one at a time.
 *
 * Offered only under the fourth space answer, so an entry following one rule
 * carries one control rather than one per part. Where it is not offered, the
 * same column reads the rule's own word for the same decision, so the column
 * says one kind of thing however the decision was arrived at.
 *
 * It is a permission rather than an instruction: "Shrink if needed" is the
 * whole truth about a partition the installer did not have to shrink.
 *
 * Every partition's decision is written back with this one, because the
 * configuration clears them all before applying the list it is given. Sending
 * only the partition that changed would quietly undo every other decision on
 * the device.
 *
 * An option that cannot apply stays offered and says why, reachable by keyboard.
 */
export default function PartitionSpaceControl({
  partition,
  governed,
  entries,
  collection,
  index,
}: PartitionSpaceControlProps): React.ReactNode {
  const [isOpen, setIsOpen] = React.useState(false);
  const setSpacePolicy = useSetSpacePolicy();

  const entryFor = (device: System.Device) => entries.find((entry) => entry.name === device.name);
  const current = decisionOf(entryFor(partition));
  const canShrink = partition.block?.shrinking?.supported === true;
  const name = baseName(partition.name);

  const choose = (decision: Decision) => {
    setIsOpen(false);

    const actions = governed
      .map((device) => ({
        deviceName: device.name,
        value: device.name === partition.name ? decision : decisionOf(entryFor(device)),
      }))
      .filter(
        (action): action is { deviceName: string; value: "delete" | "resizeIfNeeded" } =>
          action.value !== "keep",
      );

    setSpacePolicy(collection, index, { type: "custom", actions });
  };

  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      popperProps={{ position: "end" }}
      toggle={(ref) => (
        <MenuToggle
          ref={ref}
          size="sm"
          isExpanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          aria-label={sprintf(
            // TRANSLATORS: names the control deciding what the installer may do
            // to one partition. %1$s is its name, such as "vda2"; %2$s is the
            // current decision, such as "Keep".
            _("Changes allowed for %1$s: %2$s"),
            name,
            decisionLabel(current),
          )}
        >
          {decisionLabel(current)}
        </MenuToggle>
      )}
    >
      <DropdownList>
        {DECISIONS.map((decision) => {
          const refused = decision === "resizeIfNeeded" && !canShrink;

          return (
            <DropdownItem
              key={decision}
              isSelected={decision === current}
              isDanger={decision === "delete"}
              isAriaDisabled={refused}
              description={
                refused
                  ? // TRANSLATORS: why a partition cannot be allowed to shrink.
                    _("This partition cannot be made smaller.")
                  : meaning(decision)
              }
              onClick={refused ? undefined : () => choose(decision)}
            >
              {decisionLabel(decision)}
            </DropdownItem>
          );
        })}
      </DropdownList>
    </Dropdown>
  );
}

export { decisionLabel, decisionOf, decisionUnder };
export type { Decision };
