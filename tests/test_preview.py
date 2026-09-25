from pathlib import Path
import math
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import preview


def left_to_right_sum(values):
    """Float accumulation used by sum before Python 3.12."""
    result = 0
    for value in values:
        result += value
    return result


class PreviewTests(unittest.TestCase):
    def test_sitting_owls_render_identically_with_old_and_accurate_float_sums(self):
        # Python 3.10/3.14 CI rebuilds must agree even for mirrored wing faces
        # whose mathematically equal depths accumulated differently with sum.
        for species in ("owl", "eagle_owl"):
            with self.subTest(species=species):
                with patch.object(preview, "sum", left_to_right_sum, create=True):
                    old_sum_svg = preview.bird_svg(species, (300, 200), 11, "perch")
                with patch.object(preview, "sum", math.fsum, create=True):
                    accurate_sum_svg = preview.bird_svg(species, (300, 200), 11, "perch")
                self.assertEqual(old_sum_svg, accurate_sum_svg)

    def test_invisible_depth_roundoff_does_not_reorder_coplanar_faces(self):
        original_rotate = preview.rotate

        def rounded_differently(point, angles, pivot=(0, 0, 0)):
            result = original_rotate(point, angles, pivot)
            if angles == [24, 0, 0]:
                # Change only camera depth, by one representable float, in
                # opposite directions on the two symmetric wings.
                result[2] = math.nextafter(result[2], -math.inf if result[0] > 0 else math.inf)
            return result

        for species in ("owl", "eagle_owl"):
            with self.subTest(species=species):
                reference = preview.bird_svg(species, (300, 200), 11, "perch")
                with patch.object(preview, "rotate", rounded_differently):
                    perturbed = preview.bird_svg(species, (300, 200), 11, "perch")
                # The projected geometry is identical; painter order must be
                # equally stable so an unchanged build has the same SVG bytes.
                self.assertCountEqual(reference.splitlines(), perturbed.splitlines())
                self.assertEqual(reference, perturbed)


if __name__ == "__main__":
    unittest.main()
