# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require "y2storage/proposal/agama_device_planner"

module Y2Storage
  module Proposal
    # MD RAID planner for Agama.
    class AgamaMdRaidPlanner < AgamaDevicePlanner
      # @param md_config [Agama::Storage::Configs::MdRaid]
      # @param config [Agama::Storage::Config]
      # @return [Array<Planned::Device>]
      def planned_devices(md_config, config)
        [planned_md(md_config, config)]
      end

      # We always need a name for the MD because that's the current mecanism to connect members to
      # the MD (in AutoYaST the MD name is mandatory)
      #
      # This abuses the field a bit, but let's try that first before introducing another field
      def raid_name(md_config, config)
        return "/dev/md/#{md_config.name}" if md_config.name

        md_index = config.md_raids.index(md_config)
        "raid_#{md_index}"
      end

    private

      # @param md_config [Agama::Storage::Configs::MdRaid]
      # @param config [Agama::Storage::Config]
      # @return [Planned::Md]
      def planned_md(md_config, config)
        Y2Storage::Planned::Md.new.tap do |planned|
          if md_config.partitions?
            configure_partitions(planned, md_config, config)
          else
            configure_block_device(planned, md_config)
            configure_pv(planned, md_config, config)
          end

          planned.name = self.class.raid_name(md_config, config)
          planned.md_level = md_config.level
          planned.chunk_size = md_config.chunk_size
        end
      end
    end
  end
end
