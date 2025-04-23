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

require "y2storage/proposal/autoinst_partitioner"

module Y2Storage
  module Proposal
    # Maybe this class will evolve in the future to include other kind of logic.
    # For now it is just like the AutoYaST counterpart but without a second attemp
    # with "flexible sizes" that was implemented at AutoYaST for backward compatibility
    class AgamaPartitioner < AutoinstPartitioner
      # Finds the best distribution for the given planned partitions
      #
      # @see Proposal::PartitionsDistributionCalculator#best_distribution
      #
      # @param planned_partitions [Array<Planned::Partition>] List of planned partitions to create
      # @param devices            [Array<Partitionable>]
      # @return [PartitionsDistribution] Distribution of partitions
      def best_distribution(planned_partitions, devices)
        spaces = devices.map(&:free_spaces).flatten
        distribute_partitions(planned_partitions, spaces)
      end
    end
  end
end
