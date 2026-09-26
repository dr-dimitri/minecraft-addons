"""Original deep-ocean replacement and its deterministic 100-block basin.

Biome replacement alone does not lower modern Bedrock terrain. The feature
tree excavates new chunks after their surface pass; it never edits saved chunks
through a script. Coordinates are offsets from the rule's chunk origin at Y=0.
"""

BIOME = "lumen_birds:deep_sea"
BIOME_TAG = "lumen_deep_sea"
SURFACE_Y = 63
DEPTH = 100
FLOOR_Y = SURFACE_Y - DEPTH - 1


def assets():
    documents = {}

    def feature(name, kind, **fields):
        identifier = "lumen_birds:" + name
        documents[f"behavior_pack/features/{name}.json"] = {
            "format_version": "1.21.20",
            "minecraft:" + kind: {"description": {"identifier": identifier}, **fields},
        }
        return identifier

    def scatter(name, child, axis, low, high):
        distribution = {"iterations": high - low + 1, "x": 0, "y": 0, "z": 0}
        distribution[axis] = {"distribution": "fixed_grid", "extent": [low, high],
                              "step_size": 1, "grid_offset": 0}
        return feature(name, "scatter_feature", places_feature=child, distribution=distribution)

    # Deliberately replace every block in this NEW terrain volume, including
    # ores/plants. A may_replace list would leave holes in the requested depth.
    # Bedrock and adjacent chunks are outside the emitted coordinates.
    water = feature("deep_sea_water", "single_block_feature", places_block="minecraft:water",
                    enforce_placement_rules=False, enforce_survivability_rules=False)
    floor = feature("deep_sea_floor", "single_block_feature", places_block="minecraft:deepslate",
                    enforce_placement_rules=False, enforce_survivability_rules=False)
    water_column = scatter("deep_sea_water_column", water, "y", FLOOR_Y + 1, SURFACE_Y - 1)
    floor_column = scatter("deep_sea_floor_column", floor, "y", FLOOR_Y, FLOOR_Y)
    # The two ranges are disjoint, so aggregate's unspecified order is harmless.
    column = feature("deep_sea_column", "aggregate_feature", features=[water_column, floor_column])
    row = scatter("deep_sea_row", column, "z", 0, 15)
    basin = scatter("deep_sea_chunk", row, "x", 0, 15)

    documents["behavior_pack/biomes/deep_sea.biome.json"] = {
        "format_version": "1.21.110",
        "minecraft:biome": {
            "description": {"identifier": BIOME},
            "components": {
                "minecraft:climate": {"temperature": .5, "downfall": .5, "snow_accumulation": [0, 0]},
                "minecraft:tags": {"tags": [BIOME_TAG, "ocean", "deep", "overworld"]},
                "minecraft:surface_builder": {"builder": {
                    "type": "minecraft:overworld", "sea_floor_depth": 7,
                    "sea_floor_material": "minecraft:gravel", "foundation_material": "minecraft:stone",
                    "mid_material": "minecraft:gravel", "top_material": "minecraft:gravel",
                    "sea_material": "minecraft:water",
                }},
                "minecraft:replace_biomes": {"replacements": [{
                    "dimension": "minecraft:overworld",
                    "targets": ["deep_ocean", "deep_cold_ocean", "deep_lukewarm_ocean"],
                    "amount": .18, "noise_frequency_scale": 8,
                }]},
            },
        },
    }
    documents["behavior_pack/feature_rules/deep_sea_basin.json"] = {
        "format_version": "1.13.0",
        "minecraft:feature_rules": {
            "description": {"identifier": "lumen_birds:deep_sea_basin", "places_feature": basin},
            "conditions": {
                "placement_pass": "after_surface_pass",
                "minecraft:biome_filter": {"all_of": [
                    {"test": "has_biome_tag", "operator": "==", "value": BIOME_TAG},
                ]},
            },
            "distribution": {"iterations": 1, "x": 0, "y": 0, "z": 0},
        },
    }
    documents["resource_pack/biomes/deep_sea.client_biome.json"] = {
        "format_version": "1.21.110",
        "minecraft:client_biome": {
            "description": {"identifier": BIOME},
            "components": {
                "minecraft:water_appearance": {"surface_color": "#123A55"},
                "minecraft:fog_appearance": {"fog_identifier": BIOME},
            },
        },
    }
    documents["resource_pack/fogs/deep_sea.json"] = {
        "format_version": "1.16.100",
        "minecraft:fog_settings": {
            "description": {"identifier": BIOME},
            "distance": {"water": {"fog_start": 0, "fog_end": 28,
                                   "fog_color": "#092D45", "render_distance_type": "fixed"}},
        },
    }
    return documents
