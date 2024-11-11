/*
 * Copyright (c) [2024] SUSE LLC
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

import * as model from "~/storage/model/config/size";

describe("#generate", () => {
  it("returns the size in bytes from the size section", () => {
    expect(
      model.generate({
        size: 1024,
      }),
    ).toEqual({ min: 1024, max: 1024 });

    // TODO: Generate bytes from string size.
    // expect(model.generate(
    //   {
    //     size: "1 KiB"
    //   }
    // )).toEqual({ min: 1024, max: 1024 });

    expect(
      model.generate({
        size: [1024],
      }),
    ).toEqual({ min: 1024 });

    expect(
      model.generate({
        size: [1024, 2048],
      }),
    ).toEqual({ min: 1024, max: 2048 });

    expect(
      model.generate({
        size: {
          min: 1024,
        },
      }),
    ).toEqual({ min: 1024 });

    expect(
      model.generate({
        size: {
          min: 1024,
          max: 2048,
        },
      }),
    ).toEqual({ min: 1024, max: 2048 });
  });

  it("returns undefined for 'custom' value", () => {
    expect(
      model.generate({
        size: {
          min: "custom",
          max: 2048,
        },
      }),
    ).toEqual({ min: undefined, max: 2048 });
  });

  it("returns undefined if there is no size section", () => {
    expect(model.generate({})).toBeUndefined;
  });
});