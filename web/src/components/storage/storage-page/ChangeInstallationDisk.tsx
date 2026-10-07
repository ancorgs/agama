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
import { Button, Flex } from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import { useRetarget } from "~/components/storage/shared/use-retarget";
import { _ } from "~/i18n";
import configModel from "~/model/storage/config-model";
import type { Partitionable } from "~/model/storage/config-model";
import type { Storage } from "~/model/system";

export type ChangeInstallationDiskProps = {
  /** The device the installation would move off, as the configuration has it. */
  entry: Partitionable.Device;
  /** The same device as the machine reports it, where the machine has it. */
  device: Storage.Device | null;
};

/**
 * Putting the installation on a different disk, offered where the page has
 * named one and said what it will hold.
 *
 * That sentence raises one question about the disk, which is whether it is the
 * right one, and this is the act that answers it. So it leads the row and
 * carries the weight; adding a second device is a different plan rather than an
 * answer to this one, and sits plain beside it.
 *
 * The mark travels with the offer, so the same act is recognizable wherever it
 * is made. It is laid out beside the words rather than through the button's own
 * icon slot, which sets it smaller and on the text's baseline: next to the menu
 * that lays its mark out the first way, the two read as a pair of different
 * things rather than as two offers of the same kind.
 *
 * Reusing partitions is what closes it. Those partitions are the disk they are
 * on, so a plan built around them has nowhere else to go, and the page says so
 * once underneath for every option that closes together with this one. Saying
 * it again here would be the same sentence twice, a hand's width apart.
 *
 * It stays reachable while it is closed rather than being disabled outright: a
 * control the browser disables is skipped by keyboard and screen reader, and
 * the sentence explaining it is then met by a reader who never found what it
 * was about.
 *
 * It is the sheet's {@link MoveToOtherDevice} in a different place and nothing
 * more today. They are two components because they are heading apart: this one
 * is about where the installation goes, that one about where some part of it
 * goes, and only the first of those is the whole plan.
 */
export default function ChangeInstallationDisk({
  entry,
  device,
}: ChangeInstallationDiskProps): React.ReactNode {
  const { open, selector } = useRetarget(entry, device);
  const reused = configModel.partitionable.isReusingPartitions(entry);

  return (
    <>
      <Button variant="primary" isAriaDisabled={reused} onClick={reused ? undefined : open}>
        <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
          <Icon name="change_circle" />{" "}
          {
            // TRANSLATORS: offered under the summary of the installation: put
            // the whole of it on a different disk.
            _("Change installation disk")
          }
        </Flex>
      </Button>
      {selector}
    </>
  );
}
