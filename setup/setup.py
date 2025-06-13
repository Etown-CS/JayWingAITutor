# setup.py
import subprocess
import sys

def install_requirements():
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])

def run_postinstall():
    subprocess.check_call([sys.executable, "postinstall.py"])

if __name__ == "__main__":
    install_requirements()
    run_postinstall()
