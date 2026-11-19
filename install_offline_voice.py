"""Install the offline Chinese female model from its publisher's repository."""
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parent
MODEL=ROOT/'models'/'kokoro-int8-multi-lang-v1_1'
FILES={
 'model.int8.onnx':114203914,'voices.bin':53790720,'tokens.txt':1111,
 'lexicon-us-en.txt':5956885,'lexicon-zh.txt':2120131,'phone-zh.fst':88630,
 'date-zh.fst':59154,'number-zh.fst':64482,'LICENSE':11358,
}

FILES.update({'espeak-ng-data/af_dict': 121473, 'espeak-ng-data/am_dict': 63878, 'espeak-ng-data/cmn_dict': 1566335, 'espeak-ng-data/en_dict': 166944, 'espeak-ng-data/intonations': 2040, 'espeak-ng-data/phondata': 550424, 'espeak-ng-data/phonindex': 39074, 'espeak-ng-data/phontab': 55796, 'espeak-ng-data/lang/gmw/en': 140, 'espeak-ng-data/lang/sit/cmn': 686})

def main():
 for name,size in FILES.items():
  target=MODEL/name;target.parent.mkdir(parents=True,exist_ok=True)
  if target.exists() and target.stat().st_size==size:continue
  if target.exists() and target.stat().st_size>size:raise RuntimeError('Unexpected file size: '+str(target))
  url='https://huggingface.co/csukuangfj/kokoro-int8-multi-lang-v1_1/resolve/main/'+name
  subprocess.run(['curl.exe','-L','--fail','--retry','10','--retry-all-errors','--retry-delay','2','--connect-timeout','15','--continue-at','-','-o',str(target),url],check=True)
  if target.stat().st_size!=size:raise RuntimeError('Incomplete download: '+name)
 print('Offline model installed. Restart the printer to enable it.')

if __name__=='__main__':main()
