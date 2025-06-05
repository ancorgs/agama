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
import { copyApiModel } from "~/helpers/storage/api-model";
import { buildModel } from "~/helpers/storage/model";

function findModelDevice(
  apiModel: apiModel.Config,
  name: string,
  list: string,
): model.Drive | undefined {
  const model = buildModel(apiModel);
  return model[list].find((d) => d.name === name);
}

function deleteIfUnused(apiModel: apiModel.Config, name: string): apiModel.Config {
  apiModel = copyApiModel(apiModel);

  let list = "drives";
  let index = (apiModel.drives || []).findIndex((d) => d.name === name);
  if (index === -1) {
    list = "mdRaids";
    index = (apiModel.mdRaids || []).findIndex((d) => d.name === name);
    if (index === -1) return apiModel;
  }

  const device = findModelDevice(apiModel, name, list);
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

export { deleteIfUnused, addSearched };
