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

import { apiModel } from "~/api/storage/types";
import { model } from "~/types/storage";
import { copyApiModel, findDevice, findDeviceIndex } from "~/helpers/storage/api-model";
import { buildModel } from "~/helpers/storage/model";

function deviceLocation(apiModel: apiModel.Config, name: string) {
  let index;
  for (const list of ["drives", "mdRaids"]) {
    index = findDeviceIndex(apiModel, list, name);
    if (index !== -1) return { list, index };
  }

  return { list: undefined, index: -1 };
}

function buildModelDevice(
  apiModel: apiModel.Config,
  list: string,
  index: number,
): model.Drive | model.mdRaid | undefined {
  const model = buildModel(apiModel);
  return model[list].at(index);
}

function deleteIfUnused(apiModel: apiModel.Config, name: string): apiModel.Config {
  apiModel = copyApiModel(apiModel);

  const { list, index } = deviceLocation(apiModel, name);
  if (!list) return apiModel;

  const device = buildModelDevice(apiModel, list, index);
  if (!device || device.isUsed) return apiModel;

  apiModel[list].splice(index, 1);
  return apiModel;
}

function addSearched(apiModel: apiModel.Config, data: data.SearchedDevice): apiModel.Config {
  apiModel = copyApiModel(apiModel);
  apiModel[data.list] ||= [];
  apiModel[data.list].push({ name: data.name });

  return apiModel;
}

function deleteSearched(apiModel: apiModel.Config, data: data.SearchedDevice): apiModel.Config {
  apiModel = copyApiModel(apiModel);
  apiModel[data.list] = apiModel[data.list].filter((d) => d.name !== data.name);

  return apiModel;
}

function switchSearched(apiModel: apiModel.Config, data: data.SearchSwitch): apiModel.Config {
  if (data.name === data.oldName) return;

  apiModel = copyApiModel(apiModel);

  const { list, index } = deviceLocation(apiModel, data.oldName);
  if (!list) return apiModel;

  const device = findDevice(apiModel, list, index);
  const deviceModel = buildModelDevice(apiModel, list, index);

  // TODO: replace the two next calls with Radashi's fork
  const newPartitions = deviceModel.partitions.filter((p) => p.isNew);
  const existingPartitions = deviceModel.partitions.filter((p) => !p.isNew);
  const reusedPartitions = existingPartitions.filter((p) => p.isReused);
  const keepEntry = deviceModel.isExplicitBoot || reusedPartitions.length;

  if (keepEntry) {
    device.partitions = existingPartitions;
  } else {
    apiModel[list].splice(index, 1);
  }

  const targetIndex = findDeviceIndex(apiModel, data.list, data.name);
  if (targetIndex !== -1) {
    const target = findDevice(apiModel, data.list, targetIndex);
    target.partitions ||= [];
    target.partitions = [...target.partitions, ...newPartitions];
  } else {
    apiModel[data.list].push({
      name: data.name,
      partitions: newPartitions,
      spacePolicy: device.spacePolicy === "custom" ? undefined : device.spacePolicy,
    });
  }

  return apiModel;
}

export { deleteIfUnused, addSearched, deleteSearched, switchSearched };
