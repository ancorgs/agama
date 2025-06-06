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

import { useApiModel, useUpdateApiModel } from "~/hooks/storage/api-model";
import { addSearched, deleteSearched, switchSearched } from "~/helpers/storage/search";
import { QueryHookOptions } from "~/types/queries";
import { data } from "~/types/storage";

type AddSearchedFn = (data: data.SearchedDevice) => void;

function useAddSearched(options?: QueryHookOptions): AddSearchedFn {
  const apiModel = useApiModel(options);
  const updateApiModel = useUpdateApiModel();
  return (data: data.SearchedDevice) => {
    updateApiModel(addSearched(apiModel, data));
  };
}

type DeleteSearchedFn = (data: data.SearchedDevice) => void;

function useDeleteSearched(options?: QueryHookOptions): DeleteSearchedFn {
  const apiModel = useApiModel(options);
  const updateApiModel = useUpdateApiModel();
  return (data: data.SearchedDevice) => {
    updateApiModel(deleteSearched(apiModel, data));
  };
}

type SwitchSearchedFn = (data: data.SearchSwitch) => void;

function useSwitchSearched(options?: QueryHookOptions): SwitchSearchedFn {
  const apiModel = useApiModel(options);
  const updateApiModel = useUpdateApiModel();
  return (data: data.SearchSwitch) => {
    updateApiModel(switchSearched(apiModel, data));
  };
}

export { useAddSearched, useDeleteSearched, useSwitchSearched };
export type { AddSearchedFn, DeleteSearchedFn, SwitchSearchedFn };
