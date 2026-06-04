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

import configModel from "~/model/storage/config-model";
import { deviceSize, findPartitionableDevice } from "~/components/storage/utils";
import { FILESYSTEM_TYPE, FILESYSTEM_ACTION, isReusingPartition } from "./fields";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";

type SolvedSizesParams = {
  committedMountPoint: string;
  name: string;
  filesystem: string;
  device: Partitionable.Device | null;
  model: ConfigModel.Config | null;
  collection: string | undefined;
  index: string | undefined;
  solveConfig: (config?: ConfigModel.Config) => ConfigModel.Config | null;
};

/**
 * Calculates the solved sizes for a partition configuration.
 *
 * Similar to useSolvedSizes in PartitionPage.tsx, but as a pure function
 * instead of a hook, to be used within TanStack Form listeners.
 *
 * @returns Object with min and max size strings, or null if sizes cannot be calculated
 */
export function calculateSolvedSizes({
  committedMountPoint,
  name,
  filesystem,
  device,
  model,
  collection,
  index,
  solveConfig,
}: SolvedSizesParams): { min: string; max: string } | null {
  // Don't calculate solved sizes for reused partitions or empty mount points
  if (!committedMountPoint || isReusingPartition(name) || !device || !model) {
    return null;
  }

  // Skip if filesystem is not selected or is reuse action
  if (filesystem === "" || filesystem === FILESYSTEM_ACTION.REUSE) {
    return null;
  }

  const modelCollection = collection === "drives" ? "drives" : "mdRaids";

  // Build partition config without size (forcing automatic calculation)
  const partitionConfig: ConfigModel.Partition = {
    mountPath: committedMountPoint,
    name: undefined, // Always treat as new partition for size calculation
    filesystem:
      filesystem === FILESYSTEM_TYPE.AUTO
        ? undefined
        : {
            default: false,
            type: filesystem as ConfigModel.FilesystemType,
            // Omit label from the sparse model used for size calculation
            label: undefined,
          },
    size: undefined, // Force automatic sizing
  };

  let sparseModel: ConfigModel.Config | undefined;
  try {
    sparseModel = configModel.partition.add(
      model,
      modelCollection,
      Number(index),
      partitionConfig,
    );
  } catch {
    return null;
  }

  // Solve the model to get calculated sizes
  const solvedModel = solveConfig(sparseModel);
  if (!solvedModel) return null;

  const solvedDevice = findPartitionableDevice(solvedModel, collection, index);
  const solvedPartition = solvedDevice?.partitions?.find(
    (p) => p.mountPath === committedMountPoint,
  );

  if (!solvedPartition?.size) return null;

  return {
    min: solvedPartition.size.min ? deviceSize(solvedPartition.size.min) : "",
    max: solvedPartition.size.max ? deviceSize(solvedPartition.size.max) : "",
  };
}
