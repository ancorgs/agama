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

import React, {useRef, useState} from "react";
import { useNavigate } from "react-router-dom";
import { _, formatList } from "~/i18n";
import { sprintf } from "sprintf-js";
import { baseName, deviceSize, deviceLabel, formattedPath, SPACE_POLICIES } from "~/components/storage/utils";
import { useAvailableDevices } from "~/queries/storage";
import { config as type } from "~/api/storage/types";
import { StorageDevice } from "~/types/storage";
import * as driveUtils from "~/components/storage/utils/drive";
import { typeDescription, contentDescription } from "~/components/storage/utils/device";
import { Icon } from "../layout";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Divider,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Flex,
  List,
  ListItem,
  Label,
  Stack,
  StackItem,
  Split,
  SplitItem,
  Menu,
  MenuContainer,
  MenuContent,
  MenuFooter,
  MenuGroup,
  MenuItem,
  MenuItemAction,
  MenuList,
  MenuToggle,
  Dropdown,
  DropdownList,
  DropdownItem
} from "@patternfly/react-core";

type DriveEditorProps = { drive: type.DriveElement, driveDevice: StorageDevice };

// FIXME: Presentation is quite poor
const SpacePolicySelectorIntro = ({ device }) => {
  const Content = ({device}) => {
    const main = sprintf(_("Choose what to with current content: %s"), contentDescription(device));
    const systems = device.systems;

    if (systems.length > 0) {
      return (
        <>
          <span>{main}</span>
          <br />
          {systems.map((s) => <Label isCompact>{s}</Label>)}
        </>
      );
    }

    return <span>{main}</span>;
  }

  return (
    <div style={{ padding: "1em", fontWeight: "normal" }}>
      <Content device={device} />
    </div>
  );
};

const SpacePolicySelector = ({ drive, driveDevice }) => {
  const navigate = useNavigate();
  const menuRef = useRef();
  const toggleMenuRef = useRef();
  const [isOpen, setIsOpen] = useState(false);
  const onToggle = () => setIsOpen(!isOpen);

  const currentPolicy = driveUtils.spacePolicyEntry(drive);

  const PolicyItem = ({policy}) => {
    return (
      <MenuItem
        key={policy.id}
        itemId={policy.id}
        isSelected={policy.id === currentPolicy.id}
        description={policy.description}
      >
        {policy.label}
      </MenuItem>
    );
  };

  return (
    <MenuContainer
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      toggleRef={toggleMenuRef}
      toggle={
        <MenuToggle
          variant="plain"
          ref={toggleMenuRef}
          onClick={onToggle}
          isExpanded={isOpen}
          className="menu-toggle-inline"
        >
          <b>{driveUtils.contentActionsDescription(drive)}</b>
        </MenuToggle>
      }
      menuRef={menuRef}
      menu={
        <Menu ref={menuRef}>
          <MenuContent>
            <MenuList>
              <SpacePolicySelectorIntro device={driveDevice} />
              {SPACE_POLICIES.map((policy) => <PolicyItem policy={policy} />)}
            </MenuList>
          </MenuContent>
        </Menu>
      }
    />
  );
}

const SearchSelectorIntro = ({ drive }) => {
  const mainText = (drive: type.DriveElement): string => {
    if (driveUtils.hasReuse(drive)) {
      return _("This configuration uses existing partitions at the device.");
    }

    if (driveUtils.hasFilesystem(drive)) {
      if (driveUtils.hasPv(drive) || driveUtils.explicitBoot(drive)) {
        const mountPaths = drive.partitions.filter((p) => !p.name).map((p) => formattedPath(p.mountPath));

        return sprintf(
          // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
          // single mount point in the singular case).
          _(
            "Select a device to create %s",
            "Select a device to create %s",
            mountPaths.length,
          ),
          formatList(mountPaths),
        );
      }
    }

    return _("Select a device for this configuration.");
  };

  const remainText = (drive: type.DriveElement): string => {
    const name = baseName(drive.name);
    const boot = driveUtils.explicitBoot(drive);

    if (driveUtils.hasPv(drive)) {
      if (true) {
      // if (drive.volumeGroups.length > 1) {
        if (boot) {
          return sprintf(
            // TRANSLATORS: %s is the name of the disk (eg. sda)
            _("%s will still contain the configured LVM groups and any partition needed to boot."),
            name
          );
        }

        // TRANSLATORS: %s is the name of the disk (eg. sda)
        return sprintf(_("%s will still contain the configured LVM groups."), name);
      }

      if (boot) {
        return sprintf(
          // TRANSLATORS: %1$s is the name of the disk (eg. sda) and %2$s the name of the LVM
          _("%1$s will still contain the LVM group '%2$s' and any partition needed to boot."),
          name,
          drive.volumeGroups[0]
        );
      }

      return sprintf(
        // TRANSLATORS: %1$s is the name of the disk (eg. sda) and %2$s the name of the LVM
        _("%1$s will still contain the LVM group '%2$s'."),
        name,
        drive.volumeGroups[0]
      );
    }

    if (boot) {
      // TRANSLATORS: %s is the name of the disk (eg. sda)
      return sprintf(_("%s will still contain any partition needed for booting."), name);
    }
  };

  const Content = ({drive}) => {
    const main = mainText(drive);
    const extra = remainText(drive);

    if (extra) {
      return (
        <>
          <span>{main}</span>
          <br />
          <em>{extra}</em>
        </>
      );
    }

    return <span>{main}</span>;
  }

  return (
    <div style={{ padding: "1em", fontWeight: "normal" }}>
      <Content drive={drive} />
    </div>
  );
};

const SearchSelectorOptions = ({ selected }) => {
  const devices = useAvailableDevices();

  // FIXME: Presentation is quite poor
  const DeviceDescription = ({ device }) => {
    return (
      <>
        <span>{typeDescription(device)}</span>
        <span>{contentDescription(device)}</span>
        <br />
        {device.systems.map((s) => <Label isCompact>{s}</Label>)}
      </>
    );
  }

  return (
    <>
      {devices.map((device) => {
        const isSelected = device === selected;
        // FIXME: use PF/Content with #component prop instead when migrating to PF6
        const Name = () =>
          isSelected ? <b>{deviceLabel(device)}</b> : deviceLabel(device);

        return (
          <MenuItem
            key={device.sid}
            itemId={device.sid}
            isSelected={isSelected}
            description={<DeviceDescription device={device} />}
          >
            <Name />
          </MenuItem>
        );
      })}
      <MenuItem
        component="a"
        onClick={() => navigate("/storage/target-device")}
        itemId="lvm"
        description="The configured partitions will be created as logical volumes"
      >
        <Flex component="span" justifyContent={{ default: "justifyContentSpaceBetween" }}>
        <span>New LVM volume group</span>
        </Flex>
      </MenuItem>
    </>
  );
};

const SearchSelectorSingleOption = ({ selected }) => {
  return (
    <MenuItem
      isSelected
      key={selected.sid}
      itemId={selected.sid}
      description={<>{typeDescription(selected)}</>}
    >
      <b>{deviceLabel(selected)}</b>
    </MenuItem>
  );
};

const SearchSelector = ({ drive, selected }) => {
  if (driveUtils.hasReuse(drive)) {
    return (
      <>
        <SearchSelectorIntro drive={drive} />
        <SearchSelectorSingleOption selected={selected} />
      </>
    );
  }

  return (
    <>
      <SearchSelectorIntro drive={drive} />
      <SearchSelectorOptions selected={selected} />
    </>
  );
};

const RemoveDriveOption = ({ drive }) => {
  if (driveUtils.hasPv(drive)) return;
  if (driveUtils.explicitBoot(drive)) return;
  if (driveUtils.hasRoot(drive)) return;

  return (
    <>
      <Divider component="hr" />
      <MenuItem
        description={_("Remove the configuration for this device")}
      >
        {_("Do not use")}
      </MenuItem>
    </>
  );
};

const DriveSelector = ({ drive, selected }) => {
  const navigate = useNavigate();
  const menuRef = useRef();
  const toggleMenuRef = useRef();
  const [isOpen, setIsOpen] = useState(false);
  const onToggle = () => setIsOpen(!isOpen);

  return (
    <MenuContainer
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      toggleRef={toggleMenuRef}
      toggle={
        <MenuToggle
          variant="plain"
          ref={toggleMenuRef}
          onClick={onToggle}
          isExpanded={isOpen}
          className="menu-toggle-inline"
        >
          <b>{selected.name}</b>
        </MenuToggle>
      }
      menuRef={menuRef}
      menu={
        <Menu ref={menuRef} activeItemId={selected.sid}>
          <MenuContent>
            <MenuList>
              <SearchSelector drive={drive} selected={selected} />
              <RemoveDriveOption drive={drive} />
            </MenuList>
          </MenuContent>
        </Menu>
      }
    />
  );
};

const DriveHeader = ({ drive, driveDevice } : DriveEditorProps) => {
  const text = (drive: type.DriveElement): string => {
    if (driveUtils.hasFilesystem(drive)) {
      if (driveUtils.hasPv(drive)) {
        if (drive.boot) {
          // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
          return _("Use %s to install, host LVM and boot");
        } else {
          // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
          return _("Use %s to install and host LVM");
        }
      } else {
        if (drive.boot) {
          // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
          return _("Use %s to install and boot");
        } else {
          // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
          return _("Use %s to install");
        }
      }
    } else {
      if (driveUtils.hasPv(drive)) {
        if (drive.boot) {
          // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
          return _("Use %s to host LVM and boot");
        } else {
          // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
          return _("Use %s to host LVM");
        }
      } else {
        if (drive.boot) {
          // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
          return _("Use %s to boot");
        } else {
          // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
          return _("Use %s");
        }
      }
    }
  };
  
  const [txt1, txt2] = text(drive).split("%s");

  return (
    <h4>
      <span>{txt1}</span>
      <DriveSelector drive={drive} selected={driveDevice} />
      <span>{txt2}</span>
    </h4>
  );
};

const PartitionsSelector = ({ drive }) => {
  const navigate = useNavigate();
  const menuRef = useRef();
  const toggleMenuRef = useRef();
  const [isOpen, setIsOpen] = useState(false);
  const onToggle = () => setIsOpen(!isOpen);

  return (
    <MenuContainer
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      toggleRef={toggleMenuRef}
      toggle={
        <MenuToggle
          variant="plain"
          ref={toggleMenuRef}
          onClick={onToggle}
          isExpanded={isOpen}
          className="menu-toggle-inline"
        >
          <b>{driveUtils.contentDescription(drive)}</b>
        </MenuToggle>
      }
      menuRef={menuRef}
      menu={
        <Menu ref={menuRef}>
          <MenuContent>
            <MenuList>
              {drive.partitions
                .filter((p) => !p.name)
                .map((partition) => {
                  return (
                    <MenuItem
                      key={partition.mountPath}
                      itemId={partition.mountPath}
                      description="Btrfs with snapshots"
                      actions={
                        <>
                          <MenuItemAction
                            style={{ paddingInline: "4px", alignSelf: "center" }}
                            icon={<Icon name="edit_square" size="xs" aria-label={"Edit"} />}
                            actionId={`edit-${partition.mountPath}`}
                            aria-label={`Edit ${partition.mountPath}`}
                          />
                          <MenuItemAction
                            style={{ paddingInline: "4px", alignSelf: "center" }}
                            icon={<Icon name="delete" size="xs" aria-label={"Edit"} />}
                            actionId={`delete-${partition.mountPath}`}
                            aria-label={`Delete ${partition.mountPath}`}
                          />
                        </>
                      }
                    >
                      {partition.mountPath}
                    </MenuItem>
                  );
                })}
              <Divider component="li" />
              <MenuItem
                key="add-partition"
                itemId="add-partition"
                description="Add another partition or whatever"
                onClick={() => navigate("/storage/space-policy")}
              >
                <Flex component="span" justifyContent={{ default: "justifyContentSpaceBetween" }}>
                  <span>Add partition</span>
                </Flex>
              </MenuItem>
            </MenuList>
          </MenuContent>
        </Menu>
      }
    />
  );
};

export default function DriveEditor({ drive, driveDevice }: DriveEditorProps) {
  const menuRef = React.useRef();
  const toggleRef = React.useRef();
  const newContentMenuRef = React.useRef();
  const toggleNewContentMenuRef = React.useRef();
  const [isOpen, setIsOpen] = React.useState<boolean>(false);
  const [newContentMenuOpen, setNewContentMenuOpen] = React.useState<boolean>(false);
  const onToggleClick = () => setIsOpen(!isOpen);
  const onNewContentMenuToggleClick = () => setNewContentMenuOpen(!isOpen);

  return (
    <Card isCompact>
      <CardHeader>
        <CardTitle>
          <DriveHeader drive={drive} driveDevice={driveDevice} />
        </CardTitle>
      </CardHeader>
      <CardBody>
        <ul>
          <Flex component="li" gap={{ default: "gapSm" }}>
            <SpacePolicySelector drive={drive} driveDevice={driveDevice} />
          </Flex>
          <Flex component="li" gap={{ default: "gapSm" }}>
            <PartitionsSelector drive={drive} />
          </Flex>
        </ul>
      </CardBody>
    </Card>
  );
}
