// ==========================================
// FILE NAME: app.js
// DESCRIPTION: AWAS PWA Core Engine
// ==========================================

const API_BASE = 'https://awas-backend.onrender.com';

// State variables
let gpsCoordinates = null;
let ownVideoBase64 = null;
let ownHash = null;
let otherVideoBase64 = null;
let otherHash = null;
let eventTimestamp = null;
let currentWritNumber = null;
let currentLat = null;
let currentLng = null;

document.addEventListener('DOMContentLoaded', () => {
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

    // Report field refs
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

    // Step 1 — Own vehicle record
    recordTrigger.addEventListener('click', () => videoCapture.click());

    videoCapture.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        recordTrigger.style.display = 'none';
        statusDisplay.innerHTML = '⚡ <strong>SEALING YOUR EVIDENCE...</strong><br>Locking GPS, hashing video, stamping timestamp.';

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
            statusDisplay.innerHTML = `⚠️ <strong>CAPTURE FAILED:</strong><br>${fault.message}. Try again.`;
        }
    });

    // Step 2 — Other party record (optional)
    document.getElementById('btn-record-other').addEventListener('click', () => {
        otherVideoCapture.click();
    });

    otherVideoCapture.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        document.getElementById('btn-record-other').innerText = '⏳ Recording other vehicle...';
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
            document.getElementById('btn-record-other').innerText = '📹 Record Other Vehicle';
            document.getElementById('btn-record-other').disabled = false;
        }
    });

    // Step 3 — Generate report
    document.getElementById('btn-generate-report').addEventListener('click', async () => {
        const btn = document.getElementById('btn-generate-report');
        btn.innerText = '⏳ Generating Forensic Writ...';
        btn.disabled = true;

        const cachedPlate = localStorage.getItem('awas_vehicle_plate') || 'WD519A';
        const cachedModel = localStorage.getItem('awas_vehicle_model') || 'Perodua Myvi 1.5';
        const cachedMykad = localStorage.getItem('awas_mykad_four') || '5678';

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

            // Store lat/lng for PDF static map
            currentLat = gpsCoordinates.latitude.toFixed(6);
            currentLng = gpsCoordinates.longitude.toFixed(6);

            // Populate report fields
            pdfWritNum.innerText = currentWritNumber;
            document.getElementById('stamp-writ').innerText = currentWritNumber;
            pdfLogId.innerText = ownHash.substring(0, 8).toUpperCase();
            pdfDate.innerText = eventTimestamp.toLocaleDateString('en-MY');
            pdfTime.innerText = eventTimestamp.toLocaleTimeString('en-MY') + ' MYT';
            pdfPlate.innerText = cachedPlate;
            pdfModel.innerText = cachedModel;
            pdfMykad.innerText = `******-XX-${cachedMykad}`;
            pdfLat.innerText = currentLat;
            pdfLng.innerText = currentLng;
            pdfHash.innerText = ownHash;

            // Incident details
            pdfRoad.innerText = formatCondition(roadCondition);
            pdfWeather.innerText = formatCondition(weatherCondition);
            pdfInjury.innerText = formatInjury(injuryStatus);
            pdfDescription.innerText = incidentDescription || '—';

            // Map — interactive iframe for on-screen view
            mapContainer.innerHTML = `<iframe
                src="https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(currentLng)-0.005},${parseFloat(currentLat)-0.005},${parseFloat(currentLng)+0.005},${parseFloat(currentLat)+0.005}&layer=mapnik&marker=${currentLat},${currentLng}"
                style="width:100%;height:300px;border:none;margin-bottom:-80px;"
                loading="lazy">
            </iframe>`;

            // Other party
            if (otherPlate) {
                document.getElementById('pdf-other-party-section').style.display = 'block';
                document.getElementById('pdf-other-plate').innerText = otherPlate;
                document.getElementById('pdf-other-model').innerText = otherModel || '—';
                document.getElementById('sha-section-num').innerText = '5.';
            } else {
                document.getElementById('pdf-other-party-section').style.display = 'none';
                document.getElementById('sha-section-num').innerText = '4.';
            }

            // Switch banners
            testBanner.style.display = 'none';
            reportBanner.style.display = 'block';

            incidentView.style.display = 'none';
            reportView.style.display = 'flex';
            printBtn.style.display = 'block';

            window.scrollTo(0, 0);

        } catch (fault) {
            console.error('AWAS Submit Fault:', fault);
            btn.innerText = '🔒 Generate AWAS Forensic Writ';
            btn.disabled = false;
            alert('Failed to submit evidence. Check your connection and try again.');
        }
    });

    // Report modal
    printBtn.addEventListener('click', () => {
        document.getElementById('report-modal').classList.add('show');
    });
    document.getElementById('btn-close-modal').addEventListener('click', () => {
        document.getElementById('report-modal').classList.remove('show');
    });
    document.getElementById('btn-use-screen').addEventListener('click', () => {
        document.getElementById('report-modal').classList.remove('show');
    });

    // PDF DOWNLOAD — replaces window.print()
    document.getElementById('btn-get-certified').addEventListener('click', async () => {
        document.getElementById('report-modal').classList.remove('show');

        const downloadBtn = document.getElementById('print-btn');
        downloadBtn.innerText = '⏳ Preparing your PDF...';
        downloadBtn.disabled = true;

        try {
            // Swap iframe map → static image for PDF capture
            const staticMapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${currentLat},${currentLng}&zoom=16&size=560x200&markers=${currentLat},${currentLng},lightblue1`;
            mapContainer.innerHTML = `<img src="${staticMapUrl}" style="width:100%;height:100%;object-fit:cover;border:none;" alt="GPS Location Map" crossorigin="anonymous">`;

            // Wait for map image to load
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

            const fileName = `AWAS-WRIT-${(currentWritNumber || 'REPORT').replace(/\//g, '-')}.pdf`;
            pdf.save(fileName);

            // Restore interactive map after PDF save
            mapContainer.innerHTML = `<iframe
                src="https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(currentLng)-0.005},${parseFloat(currentLat)-0.005},${parseFloat(currentLng)+0.005},${parseFloat(currentLat)+0.005}&layer=mapnik&marker=${currentLat},${currentLng}"
                style="width:100%;height:300px;border:none;margin-bottom:-80px;"
                loading="lazy">
            </iframe>`;

            downloadBtn.innerText = '✅ PDF Downloaded — Check Your Files';
            downloadBtn.disabled = false;

        } catch (err) {
            console.error('PDF generation fault:', err);
            mapContainer.innerHTML = `<iframe
                src="https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(currentLng)-0.005},${parseFloat(currentLat)-0.005},${parseFloat(currentLng)+0.005},${parseFloat(currentLat)+0.005}&layer=mapnik&marker=${currentLat},${currentLng}"
                style="width:100%;height:300px;border:none;margin-bottom:-80px;"
                loading="lazy">
            </iframe>`;
            downloadBtn.innerText = '📄 Get Official Balai Writ — RM8';
            downloadBtn.disabled = false;
            alert('PDF generation failed. Please try again.');
        }
    });

    // Helpers
    function formatCondition(val) {
        const map = {
            DRY: 'Dry', WET: 'Wet / After Rain', FLOODED: 'Flooded',
            UNDER_CONSTRUCTION: 'Under Construction', UNKNOWN: '—',
            CLEAR: 'Clear / Sunny', RAINY: 'Rainy', FOGGY: 'Foggy',
            HAZY: 'Hazy', NIGHT: 'Night / Low Visibility'
        };
        return map[val] || '—';
    }

    function formatInjury(val) {
        const map = { NONE: 'No Injuries', MINOR: 'Minor Injuries', SERIOUS: 'Serious Injuries' };
        return map[val] || '—';
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
                { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
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
        navigator.serviceWorker.register('./sw.js?v=1.1.1').catch(err => console.error(err));
    });
}