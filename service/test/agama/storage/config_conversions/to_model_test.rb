# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

require_relative "../storage_helpers"
require_relative "../../../test_helper"
require "agama/storage/config_conversions"
require "agama/storage/config_solver"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

shared_examples "without alias" do |result_scope|
  it "generates the expected JSON" do
    model_json = result_scope.call(subject.convert)
    expect(model_json.keys).to_not include(:alias)
  end
end

shared_examples "without filesystem" do |result_scope|
  it "generates the expected JSON" do
    model_json = result_scope.call(subject.convert)
    expect(model_json.keys).to_not include(:mountPath)
    expect(model_json.keys).to_not include(:filesystem)
  end
end

shared_examples "without ptable_type" do |result_scope|
  it "generates the expected JSON" do
    model_json = result_scope.call(subject.convert)
    expect(model_json.keys).to_not include(:ptableType)
  end
end

shared_examples "without partitions" do |result_scope|
  it "generates the expected JSON" do
    model_json = result_scope.call(subject.convert)
    expect(model_json[:partitions]).to eq([])
  end
end

shared_examples "with alias" do |result_scope|
  let(:device_alias) { "test" }

  it "generates the expected JSON" do
    model_json = result_scope.call(subject.convert)
    expect(model_json[:alias]).to eq("test")
  end
end

describe Agama::Storage::ConfigConversions::ToModel do
  include Agama::RSpec::StorageHelpers

  let(:product_data) do
    {
      "storage" => {
        "volumes"          => ["/", "swap"],
        "volume_templates" => [
          {
            "mount_path" => "/",
            "filesystem" => "btrfs",
            "size" => {
              "auto" => true,
              "min" => "5 GiB",
              "max" => "10 GiB"
            },
            "btrfs" => {
              "snapshots" => true,
            },
            "outline" => {
              "required" => true,
              "snapshots_configurable" => true,
              "auto_size" => {
                "base_min" => "5 GiB",
                "base_max" => "10 GiB"
              }
            }
          },
          {
            "mount_path" => "/home",
            "filesystem" => "xfs",
            "size" => {
              "auto" => false,
              "min" => "5 GiB"
            },
            "outline" => {
              "required" => false
            }
          },
          {
            "mount_path" => "swap",
            "filesystem" => "swap",
            "size" => {
              "auto" => true
            },
            "outline"    => {
              "auto_size" => {
                "base_min"      => "2 GiB",
                "base_max"      => "4 GiB"
              }
            }
          },
          {
            "mount_path" => "",
            "filesystem" => "ext4",
            "size" => {
              "min" => "100 MiB"
            }
          }
        ]
      }
    }
  end

  let(:product_config) { Agama::Config.new(product_data) }

  let(:devicegraph) { Y2Storage::StorageManager.instance.probed }

  let(:config) do
    Agama::Storage::ConfigConversions::FromJSON
      .new(config_json)
      .convert
      .tap { |c| Agama::Storage::ConfigSolver.new(devicegraph, product_config).solve(c) }
  end

  before do
    mock_storage(devicegraph: scenario)
    # To speed-up the tests
    allow(Y2Storage::EncryptionMethod::TPM_FDE)
      .to(receive(:possible?))
      .and_return(true)
  end

  subject { described_class.new(config) }

  describe "#convert" do
    let(:scenario) { "disks.yaml" }

    let(:config_json) do
      {
        drives: [
          {
            partitions: [
              { search: "*", size: { min: 3 }, deleteIfNeeded: true },
              {
                alias: "root",
                id: "linux",
                filesystem: { path: "/", type: "xfs" }
              }
            ]
          }
        ]
      }
    end

    # let(:config_json) do
    #   {
    #     drives: [
    #       {
    #         filesystem: {
    #           type: "xfs"
    #         }
    #       }
    #     ]
    #   }
    # end

    it "returns a Hash" do
      expect(subject.convert).to be_a(Hash)
    end

    context "with the default config" do
      let(:config_json) { {} }

      it "generates the expected JSON" do
        expect(subject.convert).to eq(
          {
            drives: []
          }
        )
      end
    end

    context "if #drives is configured" do
      let(:config_json) do
        { drives: drives }
      end

      let(:drives) do
        [
          drive,
          {}
        ]
      end

      let(:drive) { {} }

      it "generates the expected JSON for 'drives'" do
        drives_json = subject.convert[:drives]

        expect(drives_json).to eq(
          [
            { name: "/dev/vda", spacePolicy: "keep", partitions: [] },
            { name: "/dev/vdb", spacePolicy: "keep", partitions: [] }
          ]
        )
      end

      context "if a device is not found for a drive" do
        let(:drive) { { search: "/dev/vdd" } }

        it "generates the expected JSON for 'drives'" do
          drives_json = subject.convert[:drives]

          expect(drives_json).to eq(
            [
              { name: "/dev/vda", spacePolicy: "keep", partitions: [] }
            ]
          )
        end
      end

      context "if a device is found for a drive" do
        let(:drive) { { search: "/dev/vda" } }

        it "generates the expected JSON for 'drives'" do
          drives_json = subject.convert[:drives]

          expect(drives_json).to eq(
            [
              { name: "/dev/vda", spacePolicy: "keep", partitions: [] },
              { name: "/dev/vdb", spacePolicy: "keep", partitions: [] }
            ]
          )
        end
      end

      drive_result_scope = proc { |c| c[:drives].first }
      drive_scope = proc { |c| c.drives.first }

      context "if #alias is not configured for a drive" do
        let(:drive) { {} }
        include_examples "without alias", drive_result_scope
      end

      context "if #filesystem is not configured for a drive" do
        let(:drive) { {} }
        include_examples "without filesystem", drive_result_scope
      end

      context "if #ptable_type is not configured for a drive" do
        let(:drive) { {} }
        include_examples "without ptable_type", drive_result_scope
      end

      context "if #partitions is not configured for a drive" do
        let(:drive) { {} }
        include_examples "without partitions", drive_result_scope
      end

      context "if #alias is configured for a drive" do
        let(:drive) { { alias: device_alias } }
        include_examples "with alias", drive_result_scope
      end

    end
  end
end
