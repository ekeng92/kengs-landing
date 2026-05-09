-- V028: DB-driven cleaning lists
-- Cleaning lists are named, copyable, reusable checklists that can be assigned to properties and links.
-- Items have frequency_days for smart scheduling (null = every time, 7 = weekly, 30 = monthly).
-- Change history tracks every edit for audit trail.

-- ─── cleaning_lists: named checklist templates ───────────────────────────────
CREATE TABLE cleaning_lists (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID        NOT NULL REFERENCES workspaces(id),
    name            TEXT        NOT NULL,
    description     TEXT,
    property_id     UUID        REFERENCES properties(id),
    is_template     BOOLEAN     NOT NULL DEFAULT false,
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cleaning_lists_workspace ON cleaning_lists(workspace_id);

-- ─── cleaning_list_items: individual tasks in a list ─────────────────────────
CREATE TABLE cleaning_list_items (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id         UUID        NOT NULL REFERENCES cleaning_lists(id) ON DELETE CASCADE,
    item_key        TEXT        NOT NULL,
    item_label      TEXT        NOT NULL,
    item_hint       TEXT,
    section         TEXT        NOT NULL DEFAULT 'turnover',
    group_name      TEXT,
    sort_order      INTEGER     NOT NULL DEFAULT 0,
    frequency_days  INTEGER,
    is_required     BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cleaning_list_items_list ON cleaning_list_items(list_id);

-- ─── cleaning_list_changes: audit trail ──────────────────────────────────────
CREATE TABLE cleaning_list_changes (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id         UUID        NOT NULL REFERENCES cleaning_lists(id) ON DELETE CASCADE,
    item_id         UUID        REFERENCES cleaning_list_items(id) ON DELETE SET NULL,
    changed_by      TEXT        NOT NULL,
    change_type     TEXT        NOT NULL,
    field_name      TEXT,
    old_value       TEXT,
    new_value       TEXT,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cleaning_list_changes_list ON cleaning_list_changes(list_id);

-- ─── Add list_id FK to cleaning_links ────────────────────────────────────────
ALTER TABLE cleaning_links ADD COLUMN list_id UUID REFERENCES cleaning_lists(id);

-- ─── Seed: 360 CR Turnover Checklist ─────────────────────────────────────────
-- Uses the workspace and property from existing data.
DO $$
DECLARE
    v_ws_id  UUID := 'b0604861-b7ae-4f1e-a7cb-fe066d57c623';
    v_prop_id UUID;
    v_list_id UUID;
BEGIN
    -- Get 360 County Road property
    SELECT id INTO v_prop_id FROM properties WHERE workspace_id = v_ws_id AND name ILIKE '%360%' LIMIT 1;

    -- Create the list
    INSERT INTO cleaning_lists (workspace_id, name, description, property_id, created_by)
    VALUES (v_ws_id, '360 CR Turnover Checklist', 'Full turnover, weekly, and monthly cleaning checklist for 360 County Road.', v_prop_id, 'aeon-prime')
    RETURNING id INTO v_list_id;

    -- Turnover: Laundry & Linens
    INSERT INTO cleaning_list_items (list_id, item_key, item_label, item_hint, section, group_name, sort_order, frequency_days, is_required) VALUES
    (v_list_id, 'turnover.laundry.strip_beds',    'Strip all beds — put sheets & pillowcases in washer', 'Start now!', 'turnover', 'Laundry & Linens', 10, NULL, true),
    (v_list_id, 'turnover.laundry.remake_beds',    'Remake all beds with fresh linens',                   NULL, 'turnover', 'Laundry & Linens', 20, NULL, true),
    (v_list_id, 'turnover.laundry.bath_towels',    'Fresh bath towels, hand towels, washcloths in every bath', NULL, 'turnover', 'Laundry & Linens', 30, NULL, true),
    (v_list_id, 'turnover.laundry.kitchen_towels', 'Fresh kitchen towels',                                NULL, 'turnover', 'Laundry & Linens', 40, NULL, true),
    (v_list_id, 'turnover.laundry.wash_dry',       'Wash & dry all used linens before leaving',           NULL, 'turnover', 'Laundry & Linens', 50, NULL, true),

    -- Turnover: Bedrooms
    (v_list_id, 'turnover.bedrooms.dust',          'Dust furniture & nightstands',                        NULL, 'turnover', 'Bedrooms', 60, NULL, true),
    (v_list_id, 'turnover.bedrooms.check_under',   'Check under beds for left-behind items',              NULL, 'turnover', 'Bedrooms', 70, NULL, true),

    -- Turnover: Bathrooms
    (v_list_id, 'turnover.bathrooms.toilet',       'Scrub toilet — bowl, seat, base & handle',            NULL, 'turnover', 'Bathrooms (each one)', 80, NULL, true),
    (v_list_id, 'turnover.bathrooms.sink',         'Clean sink & faucet',                                 NULL, 'turnover', 'Bathrooms (each one)', 90, NULL, true),
    (v_list_id, 'turnover.bathrooms.mirror',       'Wipe mirror (streak-free)',                            NULL, 'turnover', 'Bathrooms (each one)', 100, NULL, true),
    (v_list_id, 'turnover.bathrooms.shower',       'Check shower is clean & clear of debris',             'Light spray with soap/vinegar mix & rinse is usually enough', 'turnover', 'Bathrooms (each one)', 110, NULL, true),
    (v_list_id, 'turnover.bathrooms.restock',      'Restock: toilet paper, soap, shampoo, conditioner, body wash', NULL, 'turnover', 'Bathrooms (each one)', 120, NULL, true),

    -- Turnover: Kitchen
    (v_list_id, 'turnover.kitchen.counters',       'Wipe countertops & backsplash',                       NULL, 'turnover', 'Kitchen', 130, NULL, true),
    (v_list_id, 'turnover.kitchen.microwave_stove','Clean microwave & stovetop',                           NULL, 'turnover', 'Kitchen', 140, NULL, true),
    (v_list_id, 'turnover.kitchen.fridge',         'Clear fridge of leftover food; wipe shelves & drawers', NULL, 'turnover', 'Kitchen', 150, NULL, true),
    (v_list_id, 'turnover.kitchen.dishes',         'Dishes — wash, dry, and put away',                    NULL, 'turnover', 'Kitchen', 160, NULL, true),
    (v_list_id, 'turnover.kitchen.restock',        'Restock: paper towels, dish soap, sponge, trash bags', NULL, 'turnover', 'Kitchen', 170, NULL, true),

    -- Turnover: All Areas
    (v_list_id, 'turnover.all.trash',              'Empty ALL trash cans, replace liners',                NULL, 'turnover', 'All Areas', 180, NULL, true),
    (v_list_id, 'turnover.all.roborock',           'Roborock — empty dirty mop water bin & refill clean water bin', NULL, 'turnover', 'All Areas', 190, NULL, true),
    (v_list_id, 'turnover.all.thermostat',         'Check thermostat is on the default setting',          NULL, 'turnover', 'All Areas', 200, NULL, true),
    (v_list_id, 'turnover.all.walkthrough',        'Walk-through — note any damage or missing items below', NULL, 'turnover', 'All Areas', 210, NULL, true),

    -- Turnover: Outdoor & Hot Tub
    (v_list_id, 'turnover.outdoor.patio',          'Clear patio of trash & wipe patio furniture',          NULL, 'turnover', 'Outdoor & Hot Tub', 220, NULL, true),
    (v_list_id, 'turnover.outdoor.hottub_tablets', 'Hot tub floater — always keep at least 2 solid tablets. Add 1–2 if count is low', NULL, 'turnover', 'Outdoor & Hot Tub', 230, NULL, true),
    (v_list_id, 'turnover.outdoor.hottub_skim',    'Hot tub — skim water surface & check water level',    NULL, 'turnover', 'Outdoor & Hot Tub', 240, NULL, true),

    -- Weekly
    (v_list_id, 'weekly.mouse_traps',     'Check mouse traps — reset or replace as needed',    'Note any catches below', 'weekly', NULL, 300, 7, false),
    (v_list_id, 'weekly.blow_patio',      'Blow off patio, steps & carport',                   'Leaf blower or broom — sandy/dusty area', 'weekly', NULL, 310, 7, false),
    (v_list_id, 'weekly.hottub_shock',    'Hot tub — add one shock dose',                      'Also do after every guest', 'weekly', NULL, 320, 7, false),
    (v_list_id, 'weekly.hottub_scrub',    'Hot tub — lightly scrub sides & waterline with brush', NULL, 'weekly', NULL, 330, 7, false),
    (v_list_id, 'weekly.water_jugs',      '5-gallon water jugs — at least 1 full jug in reserve?', NULL, 'weekly', NULL, 340, 7, false),
    (v_list_id, 'weekly.supplies_check',  'Supplies check — see separate Supplies Inventory sheet', NULL, 'weekly', NULL, 350, 7, false),

    -- Monthly
    (v_list_id, 'monthly.roborock_mop_tray',  'Roborock — rinse mop tray & put back',                      NULL, 'monthly', NULL, 400, 30, false),
    (v_list_id, 'monthly.roborock_dirt_bag',  'Roborock — check dirt bag; replace if getting full',          NULL, 'monthly', NULL, 410, 30, false),
    (v_list_id, 'monthly.roborock_mop_pads',  'Roborock — swap in clean spare mop pads; put dirty pads in wash', NULL, 'monthly', NULL, 420, 30, false),
    (v_list_id, 'monthly.roborock_filter',    'Roborock — swap in clean spare filter; rinse old one, top rack of dishwasher', NULL, 'monthly', NULL, 430, 30, false),
    (v_list_id, 'monthly.roborock_brushes',   'Roborock — clear main brush & side brush of hair; wipe sensors', NULL, 'monthly', NULL, 440, 30, false),
    (v_list_id, 'monthly.shower_deep',        'Scrub shower walls & floor — all bathrooms',                  NULL, 'monthly', NULL, 450, 30, false),
    (v_list_id, 'monthly.bathroom_floors',    'Spot clean bathroom floors behind toilets & in corners',      'Where Roborock can''t reach', 'monthly', NULL, 460, 30, false),
    (v_list_id, 'monthly.switches_handles',   'Wipe light switches & door handles throughout home',          NULL, 'monthly', NULL, 470, 30, false),
    (v_list_id, 'monthly.patio_cushions',     'Patio cushions — vacuum or wipe down as needed',              NULL, 'monthly', NULL, 480, 30, false),
    (v_list_id, 'monthly.baseboards',         'Wipe baseboards in all rooms & hallways',                     NULL, 'monthly', NULL, 490, 30, false),
    (v_list_id, 'monthly.ceiling_fans',       'Wipe ceiling fans & light fixtures',                          NULL, 'monthly', NULL, 500, 30, false),
    (v_list_id, 'monthly.oven_deep',          'Deep clean oven interior',                                    'Every few months depending on use', 'monthly', NULL, 510, 90, false);

    -- Link Julie's existing token to this list
    UPDATE cleaning_links SET list_id = v_list_id WHERE workspace_id = v_ws_id AND cleaner_name ILIKE '%julie%';

END $$;
