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

module Agama
  module Storage
    module ConfigConversions
      module ToModelConversions
        # Drive conversion to JSON hash according to schema.
        class SpacePolicy
          # TODO: make it work with volume groups and raids too?
          #
          # @param config [Configs::Drive]
          def initialize(config)
            @config = config
          end

          def convert
            return "delete" if config.filesystem || delete_all_partition?
            return "resize" if shrink_all_partition?
            return "custom" if delete_partition? || resize_partition?

            "keep"
          end

        private

          attr_reader :config

          def delete_all_partition?
            config.partitions
              .select(&:delete?)
              .any? { |p| search_all?(p) }
          end

          def shrink_all_partition?
            config.partitions.any? { |p| shrink_all?(p) }
          end

          def delete_partition?
            config.partitions
              .select(&:found_device)
              .any? { |p| p.delete? || p.delete_if_needed? }
          end

          def resize_partition?
            config.partitions
              .select(&:found_device)
              .any? { |p| !p.size.default? }
          end

          def search_all?(partition_config)
            partition_config.search &&
              partition_config.search.always_match? &&
              partition_config.search.max.nil?
          end

          def shrink_all?(partition_config)
            partition_config.size && partition_config.size.min.to_i == 0
          end
        end
      end
    end
  end
end
