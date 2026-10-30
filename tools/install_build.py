from pathlib import Path
import shutil
r=Path(__file__).resolve().parent.parent
shutil.copyfile(r/"app/source/dist/perfect_pair_demo.html", r/"app/perfect_pair_demo.html")
