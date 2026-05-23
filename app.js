// ==========================================
// FILE NAME: app.js
// DESCRIPTION: AWAS PWA Core Engine
// ==========================================

const API_BASE = 'https://awas-backend.onrender.com'; // Change to production URL before deploy

document.addEventListener('DOMContentLoaded', () => {
    const recordTrigger = document.getElementById('record-trigger');
    const videoCapture = document.getElementById('video-capture');
    const statusDisplay = document.getElementById('status-display');
    const captureView = document.getElementById('capture-view');
    const reportView = document.getElementById('report-view');
    const printBtn = document.getElementById('print-btn');

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

    recordTrigger.addEventListener('click', () => {
        videoCapture.click();
    });

    videoCapture.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const videoFile = files[0];

        recordTrigger.style.display = 'none';
        statusDisplay.innerHTML = '⚡ <strong>GENERATING FORENSIC BALAI DOSSIER...</strong><br>Locking satellite GPS arrays, mapping terrain, stamping validation hash.';

        try {
            const [gpsCoordinates, videoBase64] = await Promise.all([
                acquirePreciseLocation(),
                readVideoAsBase64(videoFile)
            ]);

            const cachedPlate = localStorage.getItem('awas_vehicle_plate') || 'WD519A';
            const cachedModel = localStorage.getItem('awas_vehicle_model') || 'Perodua Myvi 1.5';
            const cachedMykad = localStorage.getItem('awas_mykad_four') || '5678';

            const eventTimestamp = new Date();

            const rawPayload = {
                vehiclePlate: cachedPlate,
                latitude: gpsCoordinates.latitude,
                longitude: gpsCoordinates.longitude,
                videoBase64: videoBase64,
                timestamp: eventTimestamp.toISOString()
            };

            const serializedPayloadString = JSON.stringify(rawPayload);
            const digitalSHA256Signature = await executeLocalSHA256(serializedPayloadString);

            // TODO Phase 2: Upload video to Cloudinary first, use returned URL below
            const videoUrl = `https://awas.media/${digitalSHA256Signature}.mp4`;

            const submissionBody = {
                logHash: digitalSHA256Signature,
                vehiclePlate: cachedPlate,
                latitude: gpsCoordinates.latitude,
                longitude: gpsCoordinates.longitude,
                videoUrl: videoUrl
            };

            await fetch(`${API_BASE}/api/logs/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submissionBody)
            });

            // Populate report fields
            pdfLogId.innerText = digitalSHA256Signature.substring(0, 8).toUpperCase();
            pdfDate.innerText = eventTimestamp.toLocaleDateString('en-MY');
            pdfTime.innerText = eventTimestamp.toLocaleTimeString('en-MY') + ' MYT';
            pdfPlate.innerText = cachedPlate;
            pdfModel.innerText = cachedModel;
            pdfMykad.innerText = `******-XX-${cachedMykad}`;
            pdfLat.innerText = gpsCoordinates.latitude.toFixed(6);
            pdfLng.innerText = gpsCoordinates.longitude.toFixed(6);
            pdfHash.innerText = digitalSHA256Signature;

            // OSM Static Map — free, no API key, works on HTTPS
            const lat = gpsCoordinates.latitude.toFixed(6);
            const lng = gpsCoordinates.longitude.toFixed(6);
            mapContainer.innerHTML = `<iframe 
    src="https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lng)-0.005},${parseFloat(lat)-0.005},${parseFloat(lng)+0.005},${parseFloat(lat)+0.005}&layer=mapnik&marker=${lat},${lng}"
    style="width:100%;height:300px;border:none;margin-bottom:-80px;"
    loading="lazy">
</iframe>`;

            captureView.style.display = 'none';
            reportView.style.display = 'flex';
            printBtn.style.display = 'block';

        } catch (fault) {
            console.error('AWAS Capture Fault:', fault);
            recordTrigger.style.display = 'flex';
            statusDisplay.innerHTML = `⚠️ <strong>INGRESS INTERRUPTION:</strong><br>${fault.message}. Move to safety lane immediately.`;
        }
    });

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

    printBtn.addEventListener('click', () => {
        document.getElementById('report-modal').classList.add('show');
    });

    document.getElementById('btn-close-modal').addEventListener('click', () => {
        document.getElementById('report-modal').classList.remove('show');
    });

    document.getElementById('btn-use-screen').addEventListener('click', () => {
        document.getElementById('report-modal').classList.remove('show');
    });

    document.getElementById('btn-get-certified').addEventListener('click', () => {
        // TODO Phase 2: Trigger Stripe/Billplz payment here
        // On payment success: call clearPaywall API then window.print()
        document.getElementById('report-modal').classList.remove('show');
        window.print();
    });
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js?v=1.0.4').catch(err => console.error(err));
    });
}