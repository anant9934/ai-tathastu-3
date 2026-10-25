"""Run from worker/:  python -m pytest -q   (no DB, no network)."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from intelligence.matching import Alum, Faculty, Student, score_alum, score_faculty  # noqa: E402

IIT_MADRAS, LPU = "inst-iitm", "inst-lpu"
CSE, VLSI = "spec-cse", "spec-vlsi"


def student(**kw) -> Student:
    base = dict(id="s1", roles=["ml_engineer", "data_scientist"], skills=["PyTorch", "Deep Learning", "SQL"],
                institution_id=IIT_MADRAS, institution_name="Indian Institute of Technology Madras",
                specialization_id=CSE, specialization_name="Computer Science and Engineering")
    base.update(kw)
    return Student(**base)


class AlumniMatchingTests(unittest.TestCase):
    def test_role_fit_and_same_university_boost(self) -> None:
        alum = Alum(id="a1", company="Acme AI", job_title="Staff ML Engineer", career_role="ml_engineer", institution_id=IIT_MADRAS)
        other_uni = Alum(id="a2", company="Acme AI", job_title="Staff ML Engineer", career_role="ml_engineer", institution_id=LPU)
        same, reasons = score_alum(alum, student())
        different, _ = score_alum(other_uni, student())
        self.assertGreater(same, different)
        self.assertAlmostEqual(same - different, 0.3)
        self.assertIn("Works as Staff ML Engineer at Acme AI, your primary goal", reasons)
        self.assertIn("Also from Indian Institute of Technology Madras", reasons)

    def test_job_title_without_career_area_still_matches(self) -> None:
        score, reasons = score_alum(Alum(id="a", company="Beta", job_title="Senior Data Scientist", career_role=None), student())
        self.assertAlmostEqual(score, 0.25)
        self.assertIn("close to your goals", reasons[0])

    def test_referrals_only_count_alongside_a_real_fit(self) -> None:
        unrelated = Alum(id="a", company="Gamma", job_title="Product Designer", career_role=None, give_back={"refer": True})
        self.assertEqual(score_alum(unrelated, student())[0], 0.0)
        fit = Alum(id="b", company="Gamma", job_title="ML Engineer", career_role="ml_engineer", give_back={"refer": True})
        score, reasons = score_alum(fit, student())
        self.assertIn("Open to referrals at Gamma", reasons)
        self.assertAlmostEqual(score, 0.55)


class FacultyMatchingTests(unittest.TestCase):
    def test_interests_overlap_skills_and_specialization(self) -> None:
        fac = Faculty(id="f", interests=["Deep reinforcement learning", "Multimodal learning"], expertise_areas=["ml_engineer"],
                      capacity=3, specialization_id=CSE)
        score, reasons = score_faculty(fac, student())
        self.assertGreaterEqual(score, 0.65)  # 0.225 interest + 0.25 field + 0.2 area
        self.assertTrue(any(r.startswith("Researches Deep reinforcement learning") for r in reasons))
        self.assertIn("Same field (Computer Science and Engineering)", reasons)
        self.assertIn("Mentors students heading to ML Engineer", reasons)

    def test_no_capacity_no_match_and_different_field_scores_lower(self) -> None:
        busy = Faculty(id="f", interests=["Deep learning"], expertise_areas=["ml_engineer"], capacity=0, specialization_id=CSE)
        self.assertEqual(score_faculty(busy, student()), (0.0, []))
        same = Faculty(id="f", interests=["SQL"], expertise_areas=[], capacity=2, specialization_id=CSE)
        other = Faculty(id="g", interests=["SQL"], expertise_areas=[], capacity=2, specialization_id=VLSI)
        self.assertGreater(score_faculty(same, student())[0], score_faculty(other, student())[0])

    def test_generic_words_dont_count_as_overlap(self) -> None:
        fac = Faculty(id="f", interests=["Machine learning"], expertise_areas=[], capacity=1)
        self.assertEqual(score_faculty(fac, student(skills=["Deep Learning"]))[0], 0.0)


if __name__ == "__main__":
    unittest.main()
