import unittest
from main import parse_methylation_report, parse_standard_labcorp

class TestParser(unittest.TestCase):

    def test_methylation_parser(self):
        sample_text = """
        Methylation Panel #3534
        Methylation Index (SAM/SAH Ratio) 3.3 2.2-6.4
        S-adenosylmethionine (SAM) 137 nanomol/L
        Homocysteine 12.0 H 3.7-10.4 micromol/L
        """
        results = parse_methylation_report(sample_text)
        
        self.assertIn('sam_sah_ratio', results)
        self.assertEqual(results['sam_sah_ratio']['value'], 3.3)
        self.assertEqual(results['sam_sah_ratio']['unit'], 'ratio')
        
        self.assertIn('homocysteine', results)
        self.assertEqual(results['homocysteine']['value'], 12.0)
        self.assertEqual(results['homocysteine']['unit'], 'micromol/L')

    def test_standard_labcorp_parser(self):
        sample_text = """
        Apolipoprotein B: 65 mg/dL
        hs-CRP: 0.4 mg/L
        Testosterone, Total: 850 ng/dL
        """
        results = parse_standard_labcorp(sample_text)
        
        self.assertIn('apoB', results)
        self.assertEqual(results['apoB']['value'], 65.0)
        
        self.assertIn('hsCRP', results)
        self.assertEqual(results['hsCRP']['value'], 0.4)
        
        self.assertIn('testosterone', results)
        self.assertEqual(results['testosterone']['value'], 850.0)

if __name__ == '__main__':
    unittest.main()
