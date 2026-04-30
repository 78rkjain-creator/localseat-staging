-- Add data_manager to the Role enum.
-- data_manager has the same operational permissions as campaign_manager
-- but is a distinct role (cannot assign other data_managers; only candidate
-- and campaign_manager can assign this role).
ALTER TYPE "Role" ADD VALUE 'data_manager' AFTER 'campaign_manager';
