/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

// @ts-check

import React, { useState } from "react";
import {
  Alert,
  Button,
  Card, CardHeader, CardTitle, CardBody, CardFooter,
  Drawer, DrawerPanelContent, DrawerContent, DrawerContentBody, DrawerHead, DrawerActions, DrawerCloseButton,
  List, ListItem, Text,
  Skeleton,
  Stack,
  DrawerPanelBody
} from "@patternfly/react-core";
import { sprintf } from "sprintf-js";
import { _, n_ } from "~/i18n";
import DevicesManager from "~/components/storage/DevicesManager";
import { ButtonLink, EmptyState } from "~/components/core";
import { ProposalActionsDialog } from "~/components/storage";
import textStyles from '@patternfly/react-styles/css/utilities/Text/text';

/**
 * @typedef {import ("~/client/storage").Action} Action
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 * @typedef {import("~/client/mixins").ValidationError} ValidationError
 */

/**
 * Renders information about planned actions, allowing to check all of them and warning with a
 * summary about the deletion ones, if any.
 * @component
 *
 * @param {object} props
 * @param {Action[]} props.actions
 * @param {string[]} props.systems
 */
const DeletionsInfo = ({ actions, systems }) => {
  const total = actions.length;

  if (total === 0) {
    return (
      <ListItem key="destructive">
        {_("Destructive actions are allowed")}
      </ListItem>
    );
  }

  // TRANSLATORS: %d will be replaced by the amount of destructive actions
  const warningTitle = sprintf(n_(
    "There is %d destructive action planned",
    "There are %d destructive actions planned ",
    total
  ), total);

  // FIXME: Use the Intl.ListFormat instead of the `join(", ")` used below.
  // Most probably, a `listFormat` or similar wrapper should live in src/i18n.js or so.
  // Read https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/ListFormat

  return (
    <ListItem key="destructive">
      {warningTitle}
      {_("affecting")} <strong>{systems.join(", ")}</strong>
    </ListItem>
  );
};

const ResizesInfo = ({ actions, systems }) => {
  const total = actions.length;

  if (total === 0) {
    return (
      <ListItem key="destructive">
        {_("Resizing devices is allowed")}
      </ListItem>
    );
  }

  // TRANSLATORS: %d will be replaced by the amount of destructive actions
  const warningTitle = sprintf(n_(
    "There is %d resize",
    "Resizing devices is allowed but not needed",
    total
  ), total);

  // FIXME: Use the Intl.ListFormat instead of the `join(", ")` used below.
  // Most probably, a `listFormat` or similar wrapper should live in src/i18n.js or so.
  // Read https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/ListFormat

  return (
    <ListItem key="resize">
      {warningTitle}
    </ListItem>
  );
};

/**
 * Renders needed UI elements to allow user check the proposal planned actions
 * @component
 *
 * @param {object} props
 * @param {Action[]} props.actions
 */
const ActionsInfo = ({ numActions, onClick }) => {
  if (numActions === 0) {
    return (
      <ListItem key="actions">
        <Text className="pf-v5-u-danger-color-100">{_("Cannot accommodate the required file systems for installation")}</Text>
      </ListItem>
    );
  }

  // TRANSLATORS: %d will be replaced by the number of proposal actions.
  const text = sprintf(
    n_("Check the planned action", "Check the %d planned actions", numActions),
    numActions
  );

  return (
    <ListItem key="actions">
      <Button onClick={onClick} variant="link" isInline>{text}</Button>
    </ListItem>
  );
};

/**
 * @todo Create a component for rendering a customized skeleton
 */
const ResultSkeleton = () => {
  return (
    <Stack hasGutter>
      <Skeleton screenreaderText={_("Waiting for information about storage configuration")} width="80%" />
      <Skeleton width="65%" />
      <Skeleton width="70%" />
    </Stack>
  );
};

/**
 * Content of the section.
 * @component
 *
 * @param {object} props
 * @param {StorageDevice[]} props.system
 * @param {StorageDevice[]} props.staging
 * @param {Action[]} props.actions
 * @param {boolean} props.isLoading
 */
const SectionContent = ({ system, staging, actions, isLoading, onActionsClick }) => {
  if (isLoading) return <ResultSkeleton />;

  const totalActions = actions.length;
  const devicesManager = new DevicesManager(system, staging, actions);

  return (
    <List>
      <DeletionsInfo
        actions={devicesManager.actions.filter(a => a.delete && !a.subvol)}
        systems={devicesManager.deletedSystems()}
      />
      <ResizesInfo
        actions={devicesManager.actions.filter(a => a.delete && !a.subvol)}
        systems={devicesManager.deletedSystems()}
      />
      <ActionsInfo numActions={totalActions} onClick={onActionsClick} />
    </List>
  );
};

/**
 * Section holding the proposal result and actions to perform in the system
 * @component
 *
 * @typedef {object} ProposalResultSectionProps
 * @property {StorageDevice[]} [system=[]]
 * @property {StorageDevice[]} [staging=[]]
 * @property {Action[]} [actions=[]]
 * @property {boolean} [isLoading=false] - Whether the section content should be rendered as loading
 *
 * @param {ProposalResultSectionProps} props
 */
export default function ProposalActionsSection({
  system = [],
  staging = [],
  actions = [],
  policy,
  spaceActions,
  onChange,
  isLoading = false
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const openDialog = () => setIsDialogOpen(true);

  const closeDialog = () => setIsDialogOpen(false);

  const onAccept = ({ spacePolicy, spaceActions }) => {
    closeDialog();
    onChange({ spacePolicy, spaceActions });
  };

  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = () => setDrawerOpen(true);
  const closeDrawer = () => setDrawerOpen(false);

  const description = _("Some actions will be performed to configure the system.");

  return (
    <Card isCompact isRounded isFullHeight>
      <Drawer isExpanded={drawerOpen}>
        <DrawerContent panelContent={
          <DrawerPanelContent focusTrap={{ enabled: true }}>
            <DrawerHead>
              <h4>{_("Planned Actions")}</h4>
              <DrawerActions>
                <DrawerCloseButton onClick={closeDrawer} />
              </DrawerActions>
            </DrawerHead>
            <DrawerPanelBody>
              <ProposalActionsDialog actions={actions} />
            </DrawerPanelBody>
          </DrawerPanelContent>
        }
        >
          <DrawerContentBody>
            <CardHeader>
              <CardTitle>
                <h3>{_("Actions")}</h3>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <div className={textStyles.color_200}>{description}</div>
            </CardBody>
            <CardBody>
              <SectionContent
                system={system}
                staging={staging}
                actions={actions}
                isLoading={isLoading}
                onActionsClick={openDrawer}
              />
            </CardBody>
            <CardFooter>{ isLoading
              ? <Skeleton fontSize="sm" width="100px" />
              : <ButtonLink isPrimary={false}>{_("Change")}</ButtonLink>}
            </CardFooter>
          </DrawerContentBody>
        </DrawerContent>
      </Drawer>
    </Card>
  );
}
