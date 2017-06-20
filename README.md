# calculate_risk_for_zika

### Steps to run:
##### 1. Clone
```bash
git clone git@github.com:unicef/calculate_risk_for_zika.git
```
##### 2. set configs
```bash
cp config-sample.js config.js
```

##### 3. Copy required data in specified folders
```
Population: ../mnt/population/worldpop/
Mosquito (aegypti): ../mnt/aegypti/simon_hay/
Travels: ../mnt/mobility/amadeus/traffic/country/
Cases (Zika): ../mnt/cases/zika/paho/iso/
```

##### 3. run
```bash
node main.js -d zika
```
Output files will be in folder ../mnt/risk/zika/
