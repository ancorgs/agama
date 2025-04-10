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

import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import LicenseDialog from "./LicenseDialog";
import { Product } from "~/types/software";
import * as softwareApi from "~/api/software";

const sle: Product = {
  id: "SLE",
  name: "SUSE Linux Enterprise",
  icon: "sle.svg",
  description: "SLE description",
  registration: true,
  license: "license.sle",
};

const mockUILanguage = "de-DE";
const product: Product = sle;
const onCloseFn = jest.fn();
let mockFetchLicense: jest.SpyInstance;

jest.mock("~/utils", () => ({
  ...jest.requireActual("~/utils"),
  locationReload: jest.fn(),
}));

jest.mock("~/context/installerL10n", () => ({
  ...jest.requireActual("~/context/installerL10n"),
  useInstallerL10n: () => ({ language: mockUILanguage }),
}));

describe("LicenseDialog", () => {
  beforeEach(() => {
    mockFetchLicense = jest
      .spyOn(softwareApi, "fetchLicense")
      .mockImplementation(jest.fn().mockResolvedValue({ body: "El contenido de la licencia" }));
  });

  it("loads given product license in the interface language", async () => {
    installerRender(<LicenseDialog product={product} onClose={onCloseFn} />, { withL10n: true });
    await waitFor(() => {
      expect(mockFetchLicense).toHaveBeenCalledWith(sle.license, mockUILanguage);
      screen.getByText("El contenido de la licencia");
    });
  });

  it("renders change language button in the header but not as part of the h1 heading", async () => {
    installerRender(<LicenseDialog product={product} onClose={onCloseFn} />);
    const header = await screen.findByRole("banner");
    const heading = await within(header).findByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(sle.name);
    within(header).getByRole("button", { name: "License language" });
  });

  it("requests license in the language selected by user", async () => {
    const { user } = installerRender(<LicenseDialog product={product} onClose={onCloseFn} />, {
      withL10n: true,
    });
    const languageButton = screen.getByRole("button", { name: "License language" });
    within(languageButton).getByText("Deutsch");
    await user.click(languageButton);
    expect(languageButton).toHaveAttribute("aria-expanded", "true");
    // FIXME: the selector should not be hidden for the Accessiblity API
    const languageFrenchOption = screen.getByRole("menuitem", { name: "Svenska", hidden: true });
    await user.click(languageFrenchOption);
    expect(mockFetchLicense).toHaveBeenCalledWith(sle.license, "sv-SE");
    within(languageButton).getByText("Svenska");
    expect(languageButton).toHaveAttribute("aria-expanded", "false");
  });

  it("triggers given callback on Close click", async () => {
    const { user } = installerRender(<LicenseDialog product={product} onClose={onCloseFn} />, {
      withL10n: true,
    });
    const closeButton = screen.getByRole("button", { name: "Close" });
    await user.click(closeButton);
    expect(onCloseFn).toHaveBeenCalled();
  });
});
