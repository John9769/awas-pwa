// ==========================================
// FILE NAME: app.js
// DESCRIPTION: AWAS PWA Core Engine
// ==========================================

const API_BASE = 'https://awas-backend.onrender.com';

let gpsCoordinates = null;
let ownVideoBase64 = null;
let ownVideoFile = null;
let ownHash = null;
let ownHashFull = null;
let otherVideoBase64 = null;
let otherHash = null;
let eventTimestamp = null;
let currentWritNumber = null;
let currentLat = null;
let currentLng = null;

// Image evidence — up to 4
let imageFiles = [];
let imageHashesFull = [];

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
        () => { gpsWarning.style.display = 'none'; captureView.style.display = 'flex'; },
        () => { gpsWarning.style.display = 'block'; captureView.style.display = 'none'; },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
}

document.addEventListener('DOMContentLoaded', () => {

    const recordTrigger = document.getElementById('record-trigger');
    const videoCapture = document.getElementById('video-capture');
    const otherVideoCapture = document.getElementById('other-video-capture');
    const imageCaptureInput = document.getElementById('image-capture');
    const statusDisplay = document.getElementById('status-display');
    const captureView = document.getElementById('capture-view');
    const photoSection = document.getElementById('photo-section');
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

    // ── RECORD VIDEO ────────────────────────────────────────────────────────
    recordTrigger.addEventListener('click', () => {
        const cachedPlate = localStorage.getItem('awas_vehicle_plate') || '';
        const plateMsg = cachedPlate ? `kenderaan anda (${cachedPlate})` : 'kenderaan anda sendiri';
        const confirmed = confirm(`⚠️ PERINGATAN AWAS\n\nSila pastikan anda merakam ${plateMsg} sahaja.\n\nVideo yang dimuat naik adalah tanggungjawab anda sepenuhnya. Writ akan dikeluarkan atas nama plat berdaftar anda.\n\nTeruskan?`);
        if (confirmed) videoCapture.click();
    });

    videoCapture.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        recordTrigger.style.display = 'none';
        statusDisplay.innerHTML = '\u26a1 <strong>METERAI BUKTI ANDA...</strong><br>Mengunci GPS, menghash video, mencap masa.';
        try {
            eventTimestamp = new Date();
            ownVideoFile = files[0];
            [gpsCoordinates, ownVideoBase64] = await Promise.all([
                acquirePreciseLocation(),
                readVideoAsBase64(files[0])
            ]);
            const cachedPlate = localStorage.getItem('awas_vehicle_plate') || '';
            const rawPayload = {
                vehiclePlate: cachedPlate,
                latitude: gpsCoordinates.latitude,
                longitude: gpsCoordinates.longitude,
                videoBase64: ownVideoBase64,
                timestamp: eventTimestamp.toISOString()
            };
            ownHash = await executeLocalSHA256(JSON.stringify(rawPayload));
            statusDisplay.innerHTML = '\u2705 <strong>VIDEO DIRAKAM.</strong><br>Snap gambar bukti kerosakan sekarang (pilihan). Tekan Teruskan apabila selesai.';
            photoSection.style.display = 'flex';
            testBanner.style.display = 'none';
        } catch (fault) {
            console.error('AWAS Capture Fault:', fault);
            recordTrigger.style.display = 'flex';
            statusDisplay.innerHTML = `\u26a0\ufe0f <strong>RAKAMAN GAGAL:</strong><br>${fault.message}. Cuba lagi.`;
        }
    });

    // ── PHOTO CAPTURE (up to 4) ──────────────────────────────────────────────
    document.getElementById('photo-trigger').addEventListener('click', () => {
        if (imageFiles.length >= 4) { alert('Maksimum 4 gambar dibenarkan.'); return; }
        imageCaptureInput.click();
    });

    imageCaptureInput.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        const file = files[0];
        if (imageFiles.length >= 4) return;
        imageFiles.push(file);
        renderImageThumbnails();
        const remaining = 4 - imageFiles.length;
        const btn = document.getElementById('photo-trigger');
        btn.innerHTML = remaining > 0 ? `📷 <span>Bukti Gambar (${imageFiles.length}/4)</span>` : `📷 <span>Gambar Penuh (4/4)</span>`;
        if (remaining === 0) btn.style.opacity = '0.6';
        imageCaptureInput.value = '';
    });

    function renderImageThumbnails() {
        const strip = document.getElementById('image-thumbnail-strip');
        strip.innerHTML = '';
        imageFiles.forEach((file, idx) => {
            const url = URL.createObjectURL(file);
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'position:relative;display:inline-block;';
            const img = document.createElement('img');
            img.src = url;
            img.style.cssText = 'width:64px;height:64px;object-fit:cover;border-radius:6px;border:2px solid #16a34a;';
            const removeBtn = document.createElement('button');
            removeBtn.innerText = '\u2715';
            removeBtn.style.cssText = 'position:absolute;top:-6px;right:-6px;background:#dc2626;color:white;border:none;border-radius:50%;width:18px;height:18px;font-size:0.6rem;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;';
            removeBtn.addEventListener('click', () => {
                imageFiles.splice(idx, 1);
                renderImageThumbnails();
                const btn = document.getElementById('photo-trigger');
                btn.innerHTML = imageFiles.length === 0 ? `📷 <span>Bukti Gambar (Maks 4)</span>` : `📷 <span>Bukti Gambar (${imageFiles.length}/4)</span>`;
                btn.style.opacity = '1';
            });
            wrapper.appendChild(img);
            wrapper.appendChild(removeBtn);
            strip.appendChild(wrapper);
        });
        strip.style.display = imageFiles.length > 0 ? 'flex' : 'none';
    }

    // ── PROCEED TO INCIDENT DETAILS ──────────────────────────────────────────
    document.getElementById('btn-proceed-incident').addEventListener('click', () => {
        captureView.style.display = 'none';
        photoSection.style.display = 'none';
        incidentView.style.display = 'flex';
    });

    // ── OTHER PARTY VIDEO ────────────────────────────────────────────────────
    document.getElementById('btn-record-other').addEventListener('click', () => { otherVideoCapture.click(); });

    otherVideoCapture.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        document.getElementById('btn-record-other').innerText = '\u23f3 Merakam kenderaan lain...';
        document.getElementById('btn-record-other').disabled = true;
        try {
            otherVideoBase64 = await readVideoAsBase64(files[0]);
            const otherPayload = { videoBase64: otherVideoBase64, linkedToHash: ownHash, timestamp: eventTimestamp.toISOString() };
            otherHash = await executeLocalSHA256(JSON.stringify(otherPayload));
            document.getElementById('other-party-pending').style.display = 'none';
            document.getElementById('other-party-captured').style.display = 'block';
        } catch (err) {
            console.error('Other party capture fault:', err);
            document.getElementById('btn-record-other').innerText = '\ud83d\udcf9 Rakam Kenderaan Lain';
            document.getElementById('btn-record-other').disabled = false;
        }
    });

    // ── GENERATE WRIT ────────────────────────────────────────────────────────
    document.getElementById('btn-generate-report').addEventListener('click', async () => {
        const btn = document.getElementById('btn-generate-report');
        if (!ownVideoFile) { showGateError('Tiada video untuk dimuat naik. Sila rakam video kenderaan anda dahulu.'); return; }
        btn.innerText = '\u23f3 Memuat naik bukti dan menjana writ...';
        btn.disabled = true;
        showGateStatus('\u23f3 <strong>MEMUAT NAIK BUKTI...</strong><br>Video dan gambar anda sedang dimuat naik ke pelayan AWAS. Jangan tutup skrin.');

        const cachedPlate = localStorage.getItem('awas_vehicle_plate') || '';
        const cachedModel = localStorage.getItem('awas_vehicle_model') || '';
        const cachedMykad = localStorage.getItem('awas_mykad_four') || '';
        const cachedVType = localStorage.getItem('awas_vehicle_type') || 'CAR';
        const cachedPhone = localStorage.getItem('awas_phone') || '\u2014';

        const incidentDescription = document.getElementById('incident-description').value.trim() || null;
        const roadCondition = document.getElementById('road-condition').value;
        const weatherCondition = document.getElementById('weather-condition').value;
        const injuryStatus = document.getElementById('injury-status').value;
        const otherPlate = document.getElementById('other-plate').value.toUpperCase().replace(/\s+/g, '') || null;
        const otherModel = document.getElementById('other-model').value.trim() || null;
        const otherVideoUrl = otherHash ? `https://awas.media/${otherHash}.mp4` : null;

        const formData = new FormData();
        formData.append('video', ownVideoFile, `awas_${ownHash.substring(0, 8)}.mp4`);
        formData.append('logHash', ownHash);
        formData.append('claimedPlate', cachedPlate);
        formData.append('latitude', gpsCoordinates.latitude);
        formData.append('longitude', gpsCoordinates.longitude);
        if (incidentDescription) formData.append('incidentDescription', incidentDescription);
        formData.append('roadCondition', roadCondition);
        formData.append('weatherCondition', weatherCondition);
        formData.append('injuryStatus', injuryStatus);
        if (otherPlate) formData.append('otherVehiclePlate', otherPlate);
        if (otherModel) formData.append('otherVehicleMakeModel', otherModel);
        if (otherVideoUrl) formData.append('otherVehicleVideoUrl', otherVideoUrl);
        if (otherHash) formData.append('otherVehicleHash', otherHash);
        imageFiles.forEach((imgFile, idx) => {
            formData.append('images', imgFile, `awas_img_${ownHash.substring(0, 8)}_${idx + 1}.jpg`);
        });

        try {
            const response = await fetch(`${API_BASE}/api/logs/verify-seal`, { method: 'POST', body: formData });
            const result = await response.json();

            if (!response.ok) {
                let msg = result.error || 'Gagal menjana writ. Cuba lagi.';
                if (result.reason === 'SUBSCRIPTION_INACTIVE') msg = '\u274c Langganan AWAS anda tidak aktif. Sila perbaharui sebelum menjana writ.';
                else if (result.reason === 'NOT_REGISTERED') msg = '\u274c Akaun AWAS tidak dijumpai. Sila log masuk semula.';
                showGateError(msg);
                btn.innerText = '\ud83d\udd12 Jana Writ Forensik AWAS';
                btn.disabled = false;
                return;
            }

            clearGateStatus();
            currentWritNumber = result.writNumber || 'AWAS/MY/PENDING';
            currentLat = gpsCoordinates.latitude.toFixed(6);
            currentLng = gpsCoordinates.longitude.toFixed(6);

            ownHashFull = ownHash;
            imageHashesFull = result.imageHashes || [];
            const maskedHash = ownHash.substring(0, 8) + '\u2022'.repeat(56);

            pdfWritNum.innerText = currentWritNumber;
            document.getElementById('stamp-writ').innerText = currentWritNumber;
            document.getElementById('checklist-writ-num').innerText = currentWritNumber;
            pdfLogId.innerText = ownHash.substring(0, 8).toUpperCase();
            pdfDate.innerText = eventTimestamp.toLocaleDateString('ms-MY');
            pdfTime.innerText = eventTimestamp.toLocaleTimeString('ms-MY') + ' MYT';
            pdfPlate.innerText = result.verifiedPlate || cachedPlate;
            pdfModel.innerText = result.vehicleMakeModel || cachedModel;
            const vtypeMap = { CAR: 'Kereta', MOTORCYCLE: 'Motosikal', LORRY: 'Lori', BUS: 'Bas', VAN: 'Van' };
            document.getElementById('pdf-vtype').innerText = vtypeMap[result.vehicleType || cachedVType] || 'Kereta';
            pdfMykad.innerText = cachedMykad ? `******-XX-${cachedMykad}` : '------';
            document.getElementById('pdf-phone').innerText = cachedPhone || '\u2014';
            pdfLat.innerText = currentLat;
            pdfLng.innerText = currentLng;
            pdfHash.innerText = maskedHash;

            const imgHashSection = document.getElementById('pdf-image-hashes-section');
            const imgHashList = document.getElementById('pdf-image-hashes-list');
            if (imageHashesFull.length > 0) {
                imgHashList.innerHTML = imageHashesFull.map((h, i) =>
                    `<div class="img-hash-row" style="margin-bottom:8px;word-break:break-all;"><span style="font-weight:800;color:#1e40af;">Gambar ${i + 1}:</span><br><span class="img-hash-masked" style="font-family:monospace;font-size:0.7rem;">${h.substring(0, 8) + '\u2022'.repeat(56)}</span></div>`
                ).join('');
                imgHashSection.style.display = 'block';
            } else {
                imgHashSection.style.display = 'none';
            }

            pdfRoad.innerText = formatKeadaanJalan(roadCondition);
            pdfWeather.innerText = formatCuaca(weatherCondition);
            pdfInjury.innerText = formatKecederaan(injuryStatus);
            pdfDescription.innerText = incidentDescription ? incidentDescription.substring(0, 150) : '\u2014';

            mapContainer.innerHTML = `<iframe
                src="https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(currentLng)-0.005},${parseFloat(currentLat)-0.005},${parseFloat(currentLng)+0.005},${parseFloat(currentLat)+0.005}&layer=mapnik&marker=${currentLat},${currentLng}"
                style="width:100%;height:300px;border:none;margin-bottom:-80px;"
                loading="lazy">
            </iframe>`;

            if (otherPlate) {
                document.getElementById('pdf-other-party-section').style.display = 'block';
                document.getElementById('pdf-other-plate').innerText = otherPlate;
                document.getElementById('pdf-other-model').innerText = otherModel || '\u2014';
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
            document.getElementById('btn-back-home').style.display = 'block';
            window.scrollTo(0, 0);

        } catch (fault) {
            console.error('AWAS Writ Fault:', fault);
            showGateError('\u26a0\ufe0f Masalah sambungan semasa memuat naik. Periksa internet anda dan cuba lagi.');
            btn.innerText = '\ud83d\udd12 Jana Writ Forensik AWAS';
            btn.disabled = false;
        }
    });

    function showGateStatus(html) {
        let box = document.getElementById('gate-status-box');
        if (!box) {
            box = document.createElement('div');
            box.id = 'gate-status-box';
            box.style.cssText = 'width:100%;background:#1e293b;border-left:5px solid #eab308;padding:16px;border-radius:8px;font-size:0.9rem;line-height:1.5;color:#fde68a;margin-bottom:4px;';
            const genBtn = document.getElementById('btn-generate-report');
            genBtn.parentNode.insertBefore(box, genBtn);
        }
        box.style.borderLeftColor = '#eab308';
        box.style.color = '#fde68a';
        box.innerHTML = html;
        box.style.display = 'block';
    }

    function showGateError(msg) {
        let box = document.getElementById('gate-status-box');
        if (!box) {
            box = document.createElement('div');
            box.id = 'gate-status-box';
            box.style.cssText = 'width:100%;background:#1e293b;border-left:5px solid #dc2626;padding:16px;border-radius:8px;font-size:0.9rem;line-height:1.5;margin-bottom:4px;';
            const genBtn = document.getElementById('btn-generate-report');
            genBtn.parentNode.insertBefore(box, genBtn);
        }
        box.style.borderLeftColor = '#dc2626';
        box.style.color = '#fca5a5';
        box.innerHTML = msg;
        box.style.display = 'block';
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function clearGateStatus() {
        const box = document.getElementById('gate-status-box');
        if (box) box.style.display = 'none';
    }

    // ── PAYWALL STATUS BOX (used by RM8 flow + resume flow) ──────────────────
    function showPaywallStatus(html, isError) {
        let box = document.getElementById('paywall-status-box');
        if (!box) {
            box = document.createElement('div');
            box.id = 'paywall-status-box';
            box.style.cssText = 'width:100%;background:#1e293b;padding:16px;border-radius:8px;font-size:0.9rem;line-height:1.5;margin-bottom:12px;';
            printBtn.parentNode.insertBefore(box, printBtn);
        }
        box.style.borderLeft = isError ? '5px solid #dc2626' : '5px solid #16a34a';
        box.style.color = isError ? '#fca5a5' : '#bbf7d0';
        box.innerHTML = html;
        box.style.display = 'block';
    }

    function clearPaywallStatus() {
        const box = document.getElementById('paywall-status-box');
        if (box) box.style.display = 'none';
    }

    printBtn.addEventListener('click', () => { document.getElementById('report-modal').classList.add('show'); });
    document.getElementById('btn-close-modal').addEventListener('click', () => { document.getElementById('report-modal').classList.remove('show'); });
    document.getElementById('btn-use-screen').addEventListener('click', () => { document.getElementById('report-modal').classList.remove('show'); });

    // ── PDF GENERATION HELPERS ────────────────────────────────────────────────
    async function captureElement(el) {
        if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return null;
        return await html2canvas(el, {
            scale: 2, useCORS: true, allowTaint: false,
            backgroundColor: '#ffffff', logging: false
        });
    }

    async function addCanvasToPdf(pdf, canvas, contentWidth, pdfHeight, margin, currentY) {
        if (!canvas) return currentY;
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgHeight = (canvas.height * contentWidth) / canvas.width;
        if (currentY + imgHeight > pdfHeight - margin) {
            pdf.addPage();
            currentY = margin;
        }
        pdf.addImage(imgData, 'JPEG', margin, currentY, contentWidth, imgHeight);
        return currentY + imgHeight + 4;
    }

    // ── GENERATE CERTIFIED PDF (RM8 — unmasked hashes) ───────────────────────
    // Extracted from the old btn-get-certified handler. Internals unchanged.
    // Called ONLY after RM8 payment is confirmed (isReportPaid === true),
    // either immediately on resume-from-ToyyibPay, or (in principle) directly
    // if ever needed again. Requires ownHashFull, imageHashesFull,
    // currentWritNumber, currentLat, currentLng and all pdf-* fields to
    // already be populated.
    function generateCertifiedPdf() {
        const downloadBtn = printBtn;
        downloadBtn.innerText = '\u23f3 Menyediakan PDF anda...';
        downloadBtn.disabled = true;
        mapContainer.innerHTML = '';

        const mapImg = document.createElement('img');
        mapImg.id = 'pdf-map-tag';
        mapImg.crossOrigin = 'anonymous';
        mapImg.style.cssText = 'width:100%;height:220px;object-fit:cover;display:block;';

        mapImg.onload = async () => {
            pdfHash.innerText = ownHashFull;
            document.querySelectorAll('.img-hash-masked').forEach((el, i) => {
                if (imageHashesFull[i]) el.innerText = imageHashesFull[i];
            });
            document.querySelectorAll('.hash-note-line').forEach(el => el.style.display = 'none');

            try {
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const margin = 10;
                const contentWidth = pdfWidth - (margin * 2);
                let y = margin;

                const secHeader = document.querySelector('.report-section.report-header');
                const secDriver = document.querySelector('#pdf-plate')?.closest('.report-section');
                y = await addCanvasToPdf(pdf, await captureElement(secHeader), contentWidth, pdfHeight, margin, y);
                y = await addCanvasToPdf(pdf, await captureElement(secDriver), contentWidth, pdfHeight, margin, y);

                pdf.addPage(); y = margin;
                const secGps = document.querySelector('#pdf-lat')?.closest('.report-section');
                const secIncident = document.querySelector('#pdf-road')?.closest('.report-section');
                const secOther = document.getElementById('pdf-other-party-section');
                y = await addCanvasToPdf(pdf, await captureElement(secGps), contentWidth, pdfHeight, margin, y);
                y = await addCanvasToPdf(pdf, await captureElement(secIncident), contentWidth, pdfHeight, margin, y);
                if (secOther && secOther.style.display !== 'none') {
                    y = await addCanvasToPdf(pdf, await captureElement(secOther), contentWidth, pdfHeight, margin, y);
                }

                pdf.addPage(); y = margin;
                const secShaTitle = document.querySelector('#sha-section-num')?.closest('.report-section');
                const shaTitle = secShaTitle?.querySelector('.section-title');
                const videoHashBox = secShaTitle?.querySelector('.hash-box');
                y = await addCanvasToPdf(pdf, await captureElement(shaTitle), contentWidth, pdfHeight, margin, y);
                y = await addCanvasToPdf(pdf, await captureElement(videoHashBox), contentWidth, pdfHeight, margin, y);

                const imgHashSec = document.getElementById('pdf-image-hashes-section');
                if (imgHashSec && imgHashSec.style.display !== 'none') {
                    pdf.addPage(); y = margin;
                    y = await addCanvasToPdf(pdf, await captureElement(imgHashSec), contentWidth, pdfHeight, margin, y);
                }

                pdf.addPage(); y = margin;
                const secStamp = document.querySelector('.awas-stamp')?.closest('.report-section');
                const secSeal = document.querySelector('.seal-note')?.closest('.report-section');
                const secFooter = document.querySelector('.footer-disclaimer')?.closest('.report-section');
                y = await addCanvasToPdf(pdf, await captureElement(secStamp), contentWidth, pdfHeight, margin, y);
                y = await addCanvasToPdf(pdf, await captureElement(secSeal), contentWidth, pdfHeight, margin, y);
                y = await addCanvasToPdf(pdf, await captureElement(secFooter), contentWidth, pdfHeight, margin, y);

                const fileName = `AWAS-WRIT-${(currentWritNumber || 'LAPORAN').replace(/\//g, '-')}.pdf`;
                pdf.save(fileName);

                pdfHash.innerText = ownHashFull.substring(0, 8) + '\u2022'.repeat(56);
                document.querySelectorAll('.img-hash-masked').forEach((el, i) => {
                    if (imageHashesFull[i]) el.innerText = imageHashesFull[i].substring(0, 8) + '\u2022'.repeat(56);
                });
                document.querySelectorAll('.hash-note-line').forEach(el => el.style.display = '');
                mapContainer.innerHTML = `<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(currentLng)-0.005},${parseFloat(currentLat)-0.005},${parseFloat(currentLng)+0.005},${parseFloat(currentLat)+0.005}&layer=mapnik&marker=${currentLat},${currentLng}" style="width:100%;height:300px;border:none;margin-bottom:-80px;" loading="lazy"></iframe>`;
                downloadBtn.innerText = '\u2705 PDF Dimuat Turun - Semak Fail Anda';
                downloadBtn.disabled = false;

            } catch (err) {
                pdfHash.innerText = ownHashFull.substring(0, 8) + '\u2022'.repeat(56);
                document.querySelectorAll('.img-hash-masked').forEach((el, i) => {
                    if (imageHashesFull[i]) el.innerText = imageHashesFull[i].substring(0, 8) + '\u2022'.repeat(56);
                });
                document.querySelectorAll('.hash-note-line').forEach(el => el.style.display = '');
                mapContainer.innerHTML = `<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(currentLng)-0.005},${parseFloat(currentLat)-0.005},${parseFloat(currentLng)+0.005},${parseFloat(currentLat)+0.005}&layer=mapnik&marker=${currentLat},${currentLng}" style="width:100%;height:300px;border:none;margin-bottom:-80px;" loading="lazy"></iframe>`;
                downloadBtn.innerText = '\ud83d\udcc4 Dapatkan Writ Balai Rasmi - RM8';
                downloadBtn.disabled = false;
                alert('RALAT: ' + err.message);
            }
        };

        mapImg.onerror = () => {
            if (ownHashFull) pdfHash.innerText = ownHashFull.substring(0, 8) + '\u2022'.repeat(56);
            document.querySelectorAll('.hash-note-line').forEach(el => el.style.display = '');
            mapContainer.innerHTML = `<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(currentLng)-0.005},${parseFloat(currentLat)-0.005},${parseFloat(currentLng)+0.005},${parseFloat(currentLat)+0.005}&layer=mapnik&marker=${currentLat},${currentLng}" style="width:100%;height:300px;border:none;margin-bottom:-80px;" loading="lazy"></iframe>`;
            downloadBtn.innerText = '\ud83d\udcc4 Dapatkan Writ Balai Rasmi - RM8';
            downloadBtn.disabled = false;
            alert('RALAT peta: Gagal memuatkan imej peta. Cuba lagi.');
        };

        mapContainer.appendChild(mapImg);
        mapImg.src = `${API_BASE}/api/maps/static?lat=${currentLat}&lng=${currentLng}&t=${Date.now()}`;
    }

    // ── RM8 PAYWALL TRIGGER (btn-get-certified) ──────────────────────────────
    // Replaces the old "generate PDF for free" behaviour. This button now
    // creates a ToyyibPay bill for RM8 and redirects the browser there.
    // Resume-state is saved to localStorage so that after the ToyyibPay
    // round-trip, app.html can recognise the returning user and auto-finish
    // the job (poll → fetch → rebuild → generateCertifiedPdf()).
    document.getElementById('btn-get-certified').addEventListener('click', async () => {
        document.getElementById('report-modal').classList.remove('show');

        if (!currentWritNumber || !ownHash) {
            alert('RALAT: Writ tidak dijumpai. Sila jana writ semula.');
            return;
        }

        const downloadBtn = printBtn;
        downloadBtn.innerText = '\u23f3 Menyediakan pembayaran...';
        downloadBtn.disabled = true;

        const verifiedPlate = pdfPlate.innerText || localStorage.getItem('awas_vehicle_plate') || '';

        try {
            const response = await fetch(`${API_BASE}/api/payment/writ`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vehiclePlate: verifiedPlate,
                    logHash: ownHash,
                    writNumber: currentWritNumber
                })
            });
            const result = await response.json();

            if (!response.ok) {
                downloadBtn.innerText = '\ud83d\udcc4 Dapatkan Writ Balai Rasmi - RM8';
                downloadBtn.disabled = false;
                alert('RALAT: ' + (result.error || 'Gagal mencipta bil pembayaran. Cuba lagi.'));
                return;
            }

            // Save resume-state — survives the ToyyibPay redirect/reload.
            localStorage.setItem('awas_pending_writ', currentWritNumber);
            localStorage.setItem('awas_pending_loghash', ownHash);
            localStorage.setItem('awas_pending_plate', verifiedPlate);

            window.location.href = result.paymentUrl;

        } catch (fault) {
            console.error('AWAS Writ Bill Fault:', fault);
            downloadBtn.innerText = '\ud83d\udcc4 Dapatkan Writ Balai Rasmi - RM8';
            downloadBtn.disabled = false;
            alert('\u26a0\ufe0f Masalah sambungan semasa mencipta bil. Periksa internet anda dan cuba lagi.');
        }
    });

    // ── RESUME AFTER RM8 PAYMENT (ToyyibPay return) ──────────────────────────
    // Runs on every page load. If the URL carries ?writ_paid=1&writ=... AND
    // localStorage has a matching pending writ, poll the backend until
    // isReportPaid flips true, rebuild the report screen from the response,
    // then auto-generate the certified PDF — no extra clicks from the user.
    async function checkResumeWritPayment() {
        const params = new URLSearchParams(window.location.search);
        const writPaid = params.get('writ_paid');
        const writParam = params.get('writ');
        const pendingWrit = localStorage.getItem('awas_pending_writ');

        if (writPaid !== '1' || !writParam || !pendingWrit || writParam !== pendingWrit) {
            return; // Not a resume case — normal page load.
        }

        const pendingLogHash = localStorage.getItem('awas_pending_loghash');
        const pendingPlate = localStorage.getItem('awas_pending_plate');

        // Hide capture/incident flow, show report shell with status message.
        captureView.style.display = 'none';
        photoSection.style.display = 'none';
        incidentView.style.display = 'none';
        testBanner.style.display = 'none';
        reportBanner.style.display = 'block';
        reportView.style.display = 'flex';
        checklistBox.style.display = 'block';
        printBtn.style.display = 'block';
        document.getElementById('btn-back-home').style.display = 'block';

        showPaywallStatus('\u23f3 <strong>MENGESAHKAN PEMBAYARAN ANDA...</strong><br>Sila tunggu sebentar. Laporan PDF akan dijana secara automatik.', false);

        const maxAttempts = 6;
        const delayMs = 2000;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await fetch(`${API_BASE}/api/logs/writ/${encodeURIComponent(writParam)}`);

                if (response.ok) {
                    const data = await response.json();

                    if (data.isReportPaid === true) {
                        rebuildReportFromPaidWrit(data, pendingPlate);

                        // Clean up resume-state and URL.
                        localStorage.removeItem('awas_pending_writ');
                        localStorage.removeItem('awas_pending_loghash');
                        localStorage.removeItem('awas_pending_plate');
                        history.replaceState({}, document.title, window.location.pathname);

                        clearPaywallStatus();
                        generateCertifiedPdf();
                        return;
                    }
                }
            } catch (err) {
                console.error('AWAS Resume Poll Fault:', err);
            }

            if (attempt < maxAttempts) {
                await new Promise(r => setTimeout(r, delayMs));
            }
        }

        // Still not paid after all attempts — webhook likely delayed.
        showPaywallStatus(
            '\u26a0\ufe0f <strong>PEMBAYARAN SEDANG DISAHKAN.</strong><br>Proses ini kadangkala mengambil masa sedikit lebih lama. Sila tunggu seminit dan muat semula halaman ini (refresh) untuk cuba lagi.' +
            '<br><br><button id="btn-resume-retry" style="background:#16a34a;color:white;border:none;padding:10px 20px;border-radius:6px;font-weight:700;cursor:pointer;">\ud83d\udd04 Cuba Lagi</button>',
            true
        );
        const retryBtn = document.getElementById('btn-resume-retry');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => window.location.reload());
        }
    }

    // ── REBUILD REPORT FROM PAID WRIT DATA ───────────────────────────────────
    // Repopulates the same variables and DOM fields that btn-generate-report
    // normally sets, using data fetched from GET /api/logs/writ/:writNumber.
    function rebuildReportFromPaidWrit(data, pendingPlate) {
        const cachedModel = localStorage.getItem('awas_vehicle_model') || '';
        const cachedMykad = localStorage.getItem('awas_mykad_four') || '';
        const cachedVType = localStorage.getItem('awas_vehicle_type') || 'CAR';
        const cachedPhone = localStorage.getItem('awas_phone') || '\u2014';

        currentWritNumber = data.writNumber;
        ownHash = data.logHash;
        ownHashFull = data.logHash;
        imageHashesFull = data.imageHashes || [];
        currentLat = parseFloat(data.latitude).toFixed(6);
        currentLng = parseFloat(data.longitude).toFixed(6);

        const createdAtDate = data.createdAt ? new Date(data.createdAt) : new Date();
        eventTimestamp = createdAtDate;

        const maskedHash = ownHashFull.substring(0, 8) + '\u2022'.repeat(56);
        const verifiedPlate = data.vehiclePlate || pendingPlate || '';

        pdfWritNum.innerText = currentWritNumber;
        document.getElementById('stamp-writ').innerText = currentWritNumber;
        document.getElementById('checklist-writ-num').innerText = currentWritNumber;
        pdfLogId.innerText = ownHashFull.substring(0, 8).toUpperCase();
        pdfDate.innerText = createdAtDate.toLocaleDateString('ms-MY');
        pdfTime.innerText = createdAtDate.toLocaleTimeString('ms-MY') + ' MYT';
        pdfPlate.innerText = verifiedPlate;
        pdfModel.innerText = cachedModel;
        const vtypeMap = { CAR: 'Kereta', MOTORCYCLE: 'Motosikal', LORRY: 'Lori', BUS: 'Bas', VAN: 'Van' };
        document.getElementById('pdf-vtype').innerText = vtypeMap[cachedVType] || 'Kereta';
        pdfMykad.innerText = cachedMykad ? `******-XX-${cachedMykad}` : '------';
        document.getElementById('pdf-phone').innerText = cachedPhone || '\u2014';
        pdfLat.innerText = currentLat;
        pdfLng.innerText = currentLng;
        pdfHash.innerText = maskedHash;

        const imgHashSection = document.getElementById('pdf-image-hashes-section');
        const imgHashList = document.getElementById('pdf-image-hashes-list');
        if (imageHashesFull.length > 0) {
            imgHashList.innerHTML = imageHashesFull.map((h, i) =>
                `<div class="img-hash-row" style="margin-bottom:8px;word-break:break-all;"><span style="font-weight:800;color:#1e40af;">Gambar ${i + 1}:</span><br><span class="img-hash-masked" style="font-family:monospace;font-size:0.7rem;">${h.substring(0, 8) + '\u2022'.repeat(56)}</span></div>`
            ).join('');
            imgHashSection.style.display = 'block';
        } else {
            imgHashSection.style.display = 'none';
        }

        pdfRoad.innerText = formatKeadaanJalan(data.roadCondition);
        pdfWeather.innerText = formatCuaca(data.weatherCondition);
        pdfInjury.innerText = formatKecederaan(data.injuryStatus);
        pdfDescription.innerText = data.incidentDescription ? data.incidentDescription.substring(0, 150) : '\u2014';

        mapContainer.innerHTML = `<iframe
            src="https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(currentLng)-0.005},${parseFloat(currentLat)-0.005},${parseFloat(currentLng)+0.005},${parseFloat(currentLat)+0.005}&layer=mapnik&marker=${currentLat},${currentLng}"
            style="width:100%;height:300px;border:none;margin-bottom:-80px;"
            loading="lazy">
        </iframe>`;

        if (data.otherVehiclePlate) {
            document.getElementById('pdf-other-party-section').style.display = 'block';
            document.getElementById('pdf-other-plate').innerText = data.otherVehiclePlate;
            document.getElementById('pdf-other-model').innerText = data.otherVehicleMakeModel || '\u2014';
            document.getElementById('sha-section-num').innerText = '5.';
        } else {
            document.getElementById('pdf-other-party-section').style.display = 'none';
            document.getElementById('sha-section-num').innerText = '4.';
        }

        window.scrollTo(0, 0);
    }

    function formatKeadaanJalan(val) {
        const map = { DRY: 'Kering', WET: 'Basah - Selepas Hujan', FLOODED: 'Banjir', UNDER_CONSTRUCTION: 'Dalam Pembinaan', UNKNOWN: 'Tidak Pasti' };
        return map[val] || 'Tidak Pasti';
    }
    function formatCuaca(val) {
        const map = { CLEAR: 'Cerah / Panas', RAINY: 'Hujan', FOGGY: 'Kabus Nipis', HAZY: 'Jerebu', NIGHT: 'Malam / Jarak Penglihatan Rendah', UNKNOWN: 'Tidak Pasti' };
        return map[val] || 'Tidak Pasti';
    }
    function formatKecederaan(val) {
        const map = { NONE: 'Tiada Kecederaan', MINOR: 'Kecederaan Ringan', SERIOUS: 'Kecederaan Serius' };
        return map[val] || 'Tiada Kecederaan';
    }
    function acquirePreciseLocation() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) { resolve({ latitude: 2.661800, longitude: 101.875900 }); return; }
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

    // ── INIT ──────────────────────────────────────────────────────────────────
    // If resuming from ToyyibPay (RM8 writ payment), skip GPS gate and resume
    // straight into the report. Otherwise normal flow: check GPS, show capture.
    const resumeParams = new URLSearchParams(window.location.search);
    if (resumeParams.get('writ_paid') === '1' && localStorage.getItem('awas_pending_writ')) {
        checkResumeWritPayment();
    } else {
        checkGPSAndProceed();
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js?v=1.6.0').catch(err => console.error(err));
    });
}