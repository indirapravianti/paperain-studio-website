// Local KiriminAja UAT run against the sandbox — no website, no Supabase.
// Uses the same weight, pricing and pickup code as checkout and the Midtrans webhook.
//   node --env-file=.env scripts/kiriminaja-uat-local.mjs quote            # rows 1-3, read-only
//   node --env-file=.env scripts/kiriminaja-uat-local.mjs pickup [key...]  # rows 4, 6, 12: spends sandbox KA Credit
//   node --env-file=.env scripts/kiriminaja-uat-local.mjs check <awb>...   # rows 13-14: label + tracking
// Results are appended to docs/uat-evidence/ as JSON.
import fs from 'node:fs';
import path from 'node:path';
import {
  createShipment,
  getCities,
  getDistricts,
  getProvinces,
  getSubdistricts,
  printShippingLabel,
  trackShipment,
} from '../lib/api/kiriminaja.js';
import { quoteKiriminajaRates } from '../lib/api/shipping-rate-handler.js';
import {
  describeOrderPackage,
  getItemDimensionsCm,
  getItemWeightGrams,
} from '../lib/api/shipping-weight.js';
import { IDR_CATEGORY_PRICES } from '../lib/api/region-pricing.js';

// Sandbox allows 10 requests/minute.
const THROTTLE_MS = 7000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DESTINATION = {
  province: 'dki jakarta',
  city: 'jakarta selatan',
  district: 'setia budi',
  subdistrict: 'karet semanggi',
  name: 'UAT Penerima',
  phone: '081234567890',
  address: 'Jl. Jenderal Sudirman No. 45, Karet Semanggi, Setiabudi, Jakarta Selatan',
  zipcode: '12930',
};

const SCENARIOS = [
  { key: 'actual-heavier', uatRow: 4, title: 'UAT Keychain', category: 'keychain', qty: 4 },
  { key: 'volume-heavier', uatRow: 6, title: 'UAT Sticker Sheet', category: 'sticker sheet', qty: 1 },
];

const PREFERRED_SERVICES = ['sicepat', 'jne', 'jnt', 'anteraja', 'idx', 'sap', 'ninja', 'lion'];

function findByName(list, name, keys) {
  const wanted = name.toLowerCase();
  const label = (row) => keys.map((k) => row[k]).find(Boolean) || '';
  return (
    list.find((row) => String(label(row)).toLowerCase() === wanted) ||
    list.find((row) => String(label(row)).toLowerCase().includes(wanted))
  );
}

async function resolveDestination() {
  const provinces = await getProvinces();
  const province = findByName(provinces, DESTINATION.province, ['provinsi_name', 'name']);
  await sleep(THROTTLE_MS);
  const cities = await getCities(province.id);
  const city = findByName(cities, DESTINATION.city, ['kabupaten_name', 'name']);
  await sleep(THROTTLE_MS);
  const districts = await getDistricts(city.id);
  const district = findByName(districts, DESTINATION.district, ['kecamatan_name', 'name']);
  await sleep(THROTTLE_MS);
  const subdistricts = await getSubdistricts(district.id);
  const subdistrict = findByName(subdistricts, DESTINATION.subdistrict, ['kelurahan_name', 'name']);
  if (!province || !city || !district || !subdistrict) {
    throw new Error(`could not resolve destination: ${JSON.stringify({ province, city, district, subdistrict })}`);
  }
  return { province, city, district, subdistrict };
}

function pickRate(rates) {
  const usable = rates.filter((r) => !r.insurance_amount);
  for (const service of PREFERRED_SERVICES) {
    const match = usable.find((r) => String(r.courier).toLowerCase() === service);
    if (match) return match;
  }
  return usable.sort((a, b) => a.customer_cost - b.customer_cost)[0];
}

function evidencePath(mode) {
  const dir = path.resolve('docs/uat-evidence');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `kiriminaja-${mode}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
}

function save(mode, data) {
  const file = evidencePath(mode);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`\nsaved ${path.relative(process.cwd(), file)}`);
}

async function quoteAll(destination, keys = []) {
  const out = [];
  for (const scenario of SCENARIOS.filter((s) => !keys.length || keys.includes(s.key))) {
    const lines = [{ category: scenario.category, qty: scenario.qty }];
    const pack = describeOrderPackage(lines);
    await sleep(THROTTLE_MS);
    const { rates } = await quoteKiriminajaRates({ lines, destinationDistrictId: destination.district.id });
    const rate = pickRate(rates);
    out.push({ scenario, pack, rate, rateCount: rates.length });
    console.log(
      `${scenario.key}: actual ${pack.actualWeightGrams} g, volumetric ${pack.volumetricWeightGrams} g ` +
        `(${pack.width}×${pack.length}×${pack.height} cm) → ${rates.length} rates, picked ` +
        `${rate?.courier} ${rate?.service_type} Rp${rate?.cost}`,
    );
  }
  return out;
}

function getNextPickupSchedule() {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  if (wib.getUTCHours() < 14) {
    wib.setUTCHours(16, 0, 0, 0);
  } else {
    wib.setUTCDate(wib.getUTCDate() + 1);
    wib.setUTCHours(10, 0, 0, 0);
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())} ${pad(wib.getUTCHours())}:00:00`;
}

function makeOrderId(index) {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const ymd = wib.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `PPRS-${ymd}-9${index}${rand}`; // 18 chars, 9x prefix marks local UAT runs
}

async function pickupAll(destination, quotes) {
  const itemDims = getItemDimensionsCm();
  const out = [];
  for (const [i, { scenario, pack, rate }] of quotes.entries()) {
    const unitPrice = IDR_CATEGORY_PRICES[scenario.category];
    const orderId = makeOrderId(i + 1);
    await sleep(THROTTLE_MS);
    let response;
    let error = null;
    try {
      response = await createShipment({
        schedule: getNextPickupSchedule(),
        packages: [
          {
            orderId,
            destinationName: DESTINATION.name,
            destinationPhone: DESTINATION.phone,
            destinationAddress: DESTINATION.address,
            destinationKecamatanId: destination.district.id,
            destinationKelurahanId: destination.subdistrict.id,
            destinationZipcode: DESTINATION.zipcode,
            weightGrams: pack.actualWeightGrams,
            widthCm: pack.width,
            lengthCm: pack.length,
            heightCm: pack.height,
            qty: scenario.qty,
            itemValue: unitPrice * scenario.qty,
            shippingCost: rate.cost,
            service: rate.courier,
            serviceType: rate.service_type,
            codAmount: 0,
            insuranceAmount: 0,
            itemName: scenario.title,
            items: [
              {
                name: scenario.title,
                price: unitPrice,
                weightGrams: getItemWeightGrams(scenario.category),
                widthCm: itemDims.width,
                lengthCm: itemDims.length,
                heightCm: itemDims.height,
                qty: scenario.qty,
              },
            ],
          },
        ],
      });
    } catch (err) {
      error = err.message;
    }
    const detail = response?.details?.[0];
    out.push({ scenario, orderId, pack, rate, response, error });
    console.log(
      `${scenario.key} (UAT row ${scenario.uatRow}): order ${orderId} → ` +
        (error ? `ERROR ${error}` : `pickup ${response?.pickup_number}, AWB ${detail?.awb || '(none yet)'}`),
    );
  }
  return out;
}

async function checkAll(awbs) {
  const out = [];
  for (const awb of awbs) {
    await sleep(THROTTLE_MS);
    const label = await printShippingLabel(awb).catch((err) => ({ error: err.message }));
    await sleep(THROTTLE_MS);
    const tracking = await trackShipment(awb).catch((err) => ({ error: err.message }));
    out.push({ awb, label, tracking });
    console.log(`${awb}: label ${label.url || label.error}, tracking ${tracking.error || tracking.text || 'ok'}`);
  }
  return out;
}

const [mode, ...args] = process.argv.slice(2);
console.log(
  `sandbox ${process.env.KIRIMINAJA_BASE_URL}, payment_method ${process.env.KIRIMINAJA_PAYMENT_METHOD || '(unset)'}\n`,
);

if (mode === 'quote' || mode === 'pickup') {
  const destination = await resolveDestination();
  console.log(
    `destination: ${destination.district.id} / ${destination.subdistrict.id} ` +
      `(${DESTINATION.district}, ${DESTINATION.subdistrict})`,
  );
  // optional scenario keys after the mode, e.g. `pickup actual-heavier`
  const quotes = await quoteAll(destination, args);
  if (mode === 'quote') {
    save('quote', { destination, quotes });
  } else {
    if (process.env.KIRIMINAJA_PAYMENT_METHOD !== 'credit') {
      throw new Error('set KIRIMINAJA_PAYMENT_METHOD=credit for local pickups, or no AWB is issued');
    }
    const pickups = await pickupAll(destination, quotes);
    save('pickup', { destination, pickups });
  }
} else if (mode === 'check' && args.length) {
  save('check', await checkAll(args));
} else {
  console.error('usage: kiriminaja-uat-local.mjs quote | pickup | check <awb>...');
  process.exit(1);
}
