// ==========================================
// FILE NAME: app.js
// DESCRIPTION: AWAS PWA Core Engine
// ==========================================

const API_BASE = 'https://awas-backend.onrender.com';

let gpsCoordinates = null;
let ownVideoBase64 = null;
let ownHash = null;
let otherVideoBase64 = null;
let otherHash = null;
let eventTimestamp = null;
let currentWritNumber = null;
let currentLat = null;
let currentLng = null;

// GPS CHECK
function checkGPSAndProceed() {
    const gpsWarning = document.getElementById('gps-warning');
    const captureView = document.getElementById('capture-view');

    if (!navigator.geolocation) {
        gpsWarning.style.display = 'block';
        captureView.style.display = 'none';
        return;
    }

    navigator.geolocation.getCurrentPosition(
        () => {
            gpsWarning.style.display = 'none';
            captureView.style.display = 'flex';
        },
        () => {
            gpsWarning.style.display = 'block';
            captureView.style.display = 'none';
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
}

document.addEventListener('DOMContentLoaded', () => {
    // Check GPS on load
    checkGPSAndProceed();

    const recordTrigger = document.getElementById('record-trigger');
    const videoCapture = document.getElementById('video-capture');
    const otherVideoCapture = document.getElementById('other-video-capture');
    const statusDisplay = document.getElementById('status-display');
    const captureView = document.getElementById('capture-view');
    const incidentView = document.getElementById('incident-view');
    const reportView = document.getElementById('report-view');
    const printBtn = document.getElementById('print-btn');
    const testBanner = document.getElementById('test-banner');
    const reportBanner = document.getElementById('report-banner');
    const checklistBox = document.getElementById('checklist-box');

    const pdfWritNum = document.getElementById('pdf-writ-number');
    const pdfLogId = document.getElementById('pdf-log-id');
    const pdfDate = document.getElementById('pdf-date');
    const pdfTime = document.getElementById('pdf-time');
    const pdfPlate = document.getElementById('pdf-plate');
    const pdfModel = document.getElementById('pdf-model');
    const pdfMykad = document.getElementById('pdf-mykad');
    const pdfLat = document.getElementById('pdf-lat');
    const pdfLng = document.getElementById('pdf-lng');
    const mapContainer = document.getElementById('map-frame-container');
    const pdfHash = document.getElementById('pdf-hash');
    const pdfRoad = document.getElementById('pdf-road');
    const pdfWeather = document.getElementById('pdf-weather');
    const pdfInjury = document.getElementById('pdf-injury');
    const pdfDescription = document.getElementById('pdf-description');

    recordTrigger.addEventListener('click', () => videoCapture.click());

    videoCapture.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        recordTrigger.style.display = 'none';
        statusDisplay.innerHTML = '⚡ <strong>METERAI BUKTI ANDA...</strong><br>Mengunci GPS, menghash video, mencap masa.';

        try {
            eventTimestamp = new Date();

            [gpsCoordinates, ownVideoBase64] = await Promise.all([
                acquirePreciseLocation(),
                readVideoAsBase64(files[0])
            ]);

            const cachedPlate = localStorage.getItem('awas_vehicle_plate') || 'WD519A';

            const rawPayload = {
                vehiclePlate: cachedPlate,
                latitude: gpsCoordinates.latitude,
                longitude: gpsCoordinates.longitude,
                videoBase64: ownVideoBase64,
                timestamp: eventTimestamp.toISOString()
            };

            ownHash = await executeLocalSHA256(JSON.stringify(rawPayload));

            captureView.style.display = 'none';
            incidentView.style.display = 'flex';

        } catch (fault) {
            console.error('AWAS Capture Fault:', fault);
            recordTrigger.style.display = 'flex';
            statusDisplay.innerHTML = `⚠️ <strong>RAKAMAN GAGAL:</strong><br>${fault.message}. Cuba lagi.`;
        }
    });

    document.getElementById('btn-record-other').addEventListener('click', () => {
        otherVideoCapture.click();
    });

    otherVideoCapture.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        document.getElementById('btn-record-other').innerText = '⏳ Merakam kenderaan lain...';
        document.getElementById('btn-record-other').disabled = true;

        try {
            otherVideoBase64 = await readVideoAsBase64(files[0]);
            const otherPayload = {
                videoBase64: otherVideoBase64,
                linkedToHash: ownHash,
                timestamp: eventTimestamp.toISOString()
            };
            otherHash = await executeLocalSHA256(JSON.stringify(otherPayload));

            document.getElementById('other-party-pending').style.display = 'none';
            document.getElementById('other-party-captured').style.display = 'block';

        } catch (err) {
            console.error('Other party capture fault:', err);
            document.getElementById('btn-record-other').innerText = '📹 Rakam Kenderaan Lain';
            document.getElementById('btn-record-other').disabled = false;
        }
    });

    document.getElementById('btn-generate-report').addEventListener('click', async () => {
        const btn = document.getElementById('btn-generate-report');
        btn.innerText = '⏳ Menjana Writ Forensik...';
        btn.disabled = true;

        const cachedPlate = localStorage.getItem('awas_vehicle_plate') || 'WD519A';
        const cachedModel = localStorage.getItem('awas_vehicle_model') || 'Perodua Myvi 1.5';
        const cachedMykad = localStorage.getItem('awas_mykad_four') || '5678';
        const cachedVType = localStorage.getItem('awas_vehicle_type') || 'CAR';
        const cachedPhone = localStorage.getItem('awas_phone') || '—';

        const incidentDescription = document.getElementById('incident-description').value.trim() || null;
        const roadCondition = document.getElementById('road-condition').value;
        const weatherCondition = document.getElementById('weather-condition').value;
        const injuryStatus = document.getElementById('injury-status').value;

        const otherPlate = document.getElementById('other-plate').value.toUpperCase().replace(/\s+/g, '') || null;
        const otherModel = document.getElementById('other-model').value.trim() || null;

        const videoUrl = `https://awas.media/${ownHash}.mp4`;
        const otherVideoUrl = otherHash ? `https://awas.media/${otherHash}.mp4` : null;

        const submissionBody = {
            logHash: ownHash,
            vehiclePlate: cachedPlate,
            latitude: gpsCoordinates.latitude,
            longitude: gpsCoordinates.longitude,
            videoUrl,
            incidentDescription,
            roadCondition,
            weatherCondition,
            injuryStatus,
            otherVehiclePlate: otherPlate,
            otherVehicleMakeModel: otherModel,
            otherVehicleVideoUrl: otherVideoUrl,
            otherVehicleHash: otherHash || null
        };

        try {
            const response = await fetch(`${API_BASE}/api/logs/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submissionBody)
            });

            const result = await response.json();
            currentWritNumber = result.writNumber || 'AWAS/MY/PENDING';
            currentLat = gpsCoordinates.latitude.toFixed(6);
            currentLng = gpsCoordinates.longitude.toFixed(6);

            pdfWritNum.innerText = currentWritNumber;
            document.getElementById('stamp-writ').innerText = currentWritNumber;
            document.getElementById('checklist-writ-num').innerText = currentWritNumber;
            pdfLogId.innerText = ownHash.substring(0, 8).toUpperCase();
            pdfDate.innerText = eventTimestamp.toLocaleDateString('ms-MY');
            pdfTime.innerText = eventTimestamp.toLocaleTimeString('ms-MY') + ' MYT';
            pdfPlate.innerText = cachedPlate;
            pdfModel.innerText = cachedModel;
            document.getElementById('pdf-vtype').innerText = cachedVType === 'MOTORCYCLE' ? 'Motosikal' : 'Kereta';
            pdfMykad.innerText = `******-XX-${cachedMykad}`;
            document.getElementById('pdf-phone').innerText = cachedPhone || '—';
            pdfLat.innerText = currentLat;
            pdfLng.innerText = currentLng;
            pdfHash.innerText = ownHash;

            pdfRoad.innerText = formatKeadaanJalan(roadCondition);
            pdfWeather.innerText = formatCuaca(weatherCondition);
            pdfInjury.innerText = formatKecederaan(injuryStatus);
            pdfDescription.innerText = incidentDescription || '—';

            mapContainer.innerHTML = `<iframe
                src="https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(currentLng)-0.005},${parseFloat(currentLat)-0.005},${parseFloat(currentLng)+0.005},${parseFloat(currentLat)+0.005}&layer=mapnik&marker=${currentLat},${currentLng}"
                style="width:100%;height:300px;border:none;margin-bottom:-80px;"
                loading="lazy">
            </iframe>`;

            if (otherPlate) {
                document.getElementById('pdf-other-party-section').style.display = 'block';
                document.getElementById('pdf-other-plate').innerText = otherPlate;
                document.getElementById('pdf-other-model').innerText = otherModel || '—';
                document.getElementById('sha-section-num').innerText = '5.';
            } else {
                document.getElementById('pdf-other-party-section').style.display = 'none';
                document.getElementById('sha-section-num').innerText = '4.';
            }

            testBanner.style.display = 'none';
            reportBanner.style.display = 'block';
            incidentView.style.display = 'none';
            reportView.style.display = 'flex';
            checklistBox.style.display = 'block';
            printBtn.style.display = 'block';

            window.scrollTo(0, 0);

        } catch (fault) {
            console.error('AWAS Submit Fault:', fault);
            btn.innerText = '🔒 Jana Writ Forensik AWAS';
            btn.disabled = false;
            alert('Gagal menghantar bukti. Periksa sambungan anda dan cuba lagi.');
        }
    });

    printBtn.addEventListener('click', () => {
        document.getElementById('report-modal').classList.add('show');
    });
    document.getElementById('btn-close-modal').addEventListener('click', () => {
        document.getElementById('report-modal').classList.remove('show');
    });
    document.getElementById('btn-use-screen').addEventListener('click', () => {
        document.getElementById('report-modal').classList.remove('show');
    });

    document.getElementById('btn-get-certified').addEventListener('click', async () => {
        document.getElementById('report-modal').classList.remove('show');

        const downloadBtn = document.getElementById('print-btn');
        downloadBtn.innerText = '⏳ Menyediakan PDF anda...';
        downloadBtn.disabled = true;

        try {
            const staticMapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${currentLat},${currentLng}&zoom=16&size=560x200&markers=${currentLat},${currentLng},lightblue1`;
            mapContainer.innerHTML = `<img src="${staticMapUrl}" style="width:100%;height:100%;object-fit:cover;border:none;" alt="Peta Lokasi GPS" crossorigin="anonymous">`;

            await new Promise(resolve => setTimeout(resolve, 2000));

            const reportEl = document.getElementById('report-view');
            const canvas = await html2canvas(reportEl, {
                scale: 2,
                useCORS: true,
                allowTaint: false,
                backgroundColor: '#ffffff',
                logging: false
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = pageWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            const fileName = `AWAS-WRIT-${(currentWritNumber || 'LAPORAN').replace(/\//g, '-')}.pdf`;
            pdf.save(fileName);

            mapContainer.innerHTML = `<iframe
                src="https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(currentLng)-0.005},${parseFloat(currentLat)-0.005},${parseFloat(currentLng)+0.005},${parseFloat(currentLat)+0.005}&layer=mapnik&marker=${currentLat},${currentLng}"
                style="width:100%;height:300px;border:none;margin-bottom:-80px;"
                loading="lazy">
            </iframe>`;

            downloadBtn.innerText = '✅ PDF Dimuat Turun — Semak Fail Anda';
            downloadBtn.disabled = false;

        } catch (err) {
            console.error('PDF generation fault:', err);
            mapContainer.innerHTML = `<iframe
                src="https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(currentLng)-0.005},${parseFloat(currentLat)-0.005},${parseFloat(currentLng)+0.005},${parseFloat(currentLat)+0.005}&layer=mapnik&marker=${currentLat},${currentLng}"
                style="width:100%;height:300px;border:none;margin-bottom:-80px;"
                loading="lazy">
            </iframe>`;
            downloadBtn.innerText = '📄 Dapatkan Writ Balai Rasmi — RM8';
            downloadBtn.disabled = false;
            alert('Jana PDF gagal. Sila cuba lagi.');
        }
    });

    // MALAY FORMAT HELPERS
    function formatKeadaanJalan(val) {
        const map = {
            DRY: 'Kering',
            WET: 'Basah — Selepas Hujan',
            FLOODED: 'Banjir',
            UNDER_CONSTRUCTION: 'Dalam Pembinaan',
            UNKNOWN: 'Tidak Pasti'
        };
        return map[val] || 'Tidak Pasti';
    }

    function formatCuaca(val) {
        const map = {
            CLEAR: 'Cerah / Panas',
            RAINY: 'Hujan',
            FOGGY: 'Kabus Nipis',
            HAZY: 'Jerebu',
            NIGHT: 'Malam / Jarak Penglihatan Rendah',
            UNKNOWN: 'Tidak Pasti'
        };
        return map[val] || 'Tidak Pasti';
    }

    function formatKecederaan(val) {
        const map = {
            NONE: 'Tiada Kecederaan',
            MINOR: 'Kecederaan Ringan',
            SERIOUS: 'Kecederaan Serius'
        };
        return map[val] || 'Tiada Kecederaan';
    }

    function acquirePreciseLocation() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve({ latitude: 2.661800, longitude: 101.875900 });
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                () => resolve({ latitude: 2.661800, longitude: 101.875900 }),
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
            );
        });
    }

    function readVideoAsBase64(fileTarget) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(fileTarget);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (err) => reject(err);
        });
    }

    async function executeLocalSHA256(inputMessageString) {
        const msgBuffer = new TextEncoder().encode(inputMessageString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js?v=1.1.3').catch(err => console.error(err));
    });
}