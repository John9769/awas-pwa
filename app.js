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
    checkGPSAndProceed();

    const recordTrigger = document.getElementById('record-trigger');
    const videoCapture = document.getElementById('video-capture');
    const otherVideoCapture = document.getElementById('other-video-capture');
    const imageCaptureInput = document.getElementById('image-capture');
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
        document.getElementById('photo-trigger').style.display = 'none';
        statusDisplay.innerHTML = '\u26a1 <strong>METERAI BUKTI ANDA...</strong><br>Mengunci GPS, menghash video, mencap masa.';

        try {
            eventTimestamp = new Date();
            ownVideoFile = files[0];

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
            testBanner.style.display = 'none';

        } catch (fault) {
            console.error('AWAS Capture Fault:', fault);
            recordTrigger.style.display = 'flex';
            document.getElementById('photo-trigger').style.display = 'flex';
            statusDisplay.innerHTML = `\u26a0\ufe0f <strong>RAKAMAN GAGAL:</strong><br>${fault.message}. Cuba lagi.`;
        }
    });

    // ── PHOTO CAPTURE (up to 4) ──────────────────────────────────────────────
    document.getElementById('photo-trigger').addEventListener('click', () => {
        if (imageFiles.length >= 4) {
            alert('Maksimum 4 gambar dibenarkan.');
            return;
        }
        imageCaptureInput.click();
    });

    imageCaptureInput.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        if (imageFiles.length >= 4) return;

        imageFiles.push(file);
        renderImageThumbnails();

        // Update photo button label
        const remaining = 4 - imageFiles.length;
        const btn = document.getElementById('photo-trigger');
        btn.innerHTML = remaining > 0
            ? `📷 <span>Gambar Bukti (${imageFiles.length}/4)</span>`
            : `📷 <span>Gambar Penuh (4/4)</span>`;
        if (remaining === 0) btn.style.opacity = '0.6';

        // Reset input so same file can be re-selected if needed
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
            removeBtn.innerText = '✕';
            removeBtn.style.cssText = 'position:absolute;top:-6px;right:-6px;background:#dc2626;color:white;border:none;border-radius:50%;width:18px;height:18px;font-size:0.6rem;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;';
            removeBtn.addEventListener('click', () => {
                imageFiles.splice(idx, 1);
                renderImageThumbnails();
                const btn = document.getElementById('photo-trigger');
                const remaining = 4 - imageFiles.length;
                btn.innerHTML = imageFiles.length === 0
                    ? `📷 <span>Gambar Bukti (Maks 4)</span>`
                    : `📷 <span>Gambar Bukti (${imageFiles.length}/4)</span>`;
                btn.style.opacity = '1';
            });

            wrapper.appendChild(img);
            wrapper.appendChild(removeBtn);
            strip.appendChild(wrapper);
        });
        strip.style.display = imageFiles.length > 0 ? 'flex' : 'none';
    }

    // ── OTHER PARTY VIDEO ────────────────────────────────────────────────────
    document.getElementById('btn-record-other').addEventListener('click', () => {
        otherVideoCapture.click();
    });

    otherVideoCapture.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        document.getElementById('btn-record-other').innerText = '\u23f3 Merakam kenderaan lain...';
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
            document.getElementById('btn-record-other').innerText = '\ud83d\udcf9 Rakam Kenderaan Lain';
            document.getElementById('btn-record-other').disabled = false;
        }
    });

    // ── GENERATE WRIT ────────────────────────────────────────────────────────
    document.getElementById('btn-generate-report').addEventListener('click', async () => {
        const btn = document.getElementById('btn-generate-report');

        if (!ownVideoFile) {
            showGateError('Tiada video untuk dimuat naik. Sila rakam video kenderaan anda dahulu.');
            return;
        }

        btn.innerText = '\u23f3 Memuat naik bukti dan menjana writ...';
        btn.disabled = true;
        showGateStatus('\u23f3 <strong>MEMUAT NAIK BUKTI...</strong><br>Video dan gambar anda sedang dimuat naik ke pelayan AWAS. Jangan tutup skrin.');

        const cachedPlate = localStorage.getItem('awas_vehicle_plate') || 'WD519A';
        const cachedModel = localStorage.getItem('awas_vehicle_model') || 'Perodua Myvi 1.5';
        const cachedMykad = localStorage.getItem('awas_mykad_four') || '5678';
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

        // Append images
        imageFiles.forEach((imgFile, idx) => {
            formData.append('images', imgFile, `awas_img_${ownHash.substring(0, 8)}_${idx + 1}.jpg`);
        });

        try {
            const response = await fetch(`${API_BASE}/api/logs/verify-seal`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                let msg = result.error || 'Gagal menjana writ. Cuba lagi.';
                if (result.reason === 'SUBSCRIPTION_INACTIVE') {
                    msg = '\u274c Langganan AWAS anda tidak aktif. Sila perbaharui sebelum menjana writ.';
                } else if (result.reason === 'NOT_REGISTERED') {
                    msg = '\u274c Akaun AWAS tidak dijumpai. Sila log masuk semula.';
                }
                showGateError(msg);
                btn.innerText = '\ud83d\udd12 Jana Writ Forensik AWAS';
                btn.disabled = false;
                return;
            }

            clearGateStatus();
            currentWritNumber = result.writNumber || 'AWAS/MY/PENDING';
            currentLat = gpsCoordinates.latitude.toFixed(6);
            currentLng = gpsCoordinates.longitude.toFixed(6);

            // Store full hashes — masked on screen, revealed in PDF
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
            pdfMykad.innerText = `******-XX-${cachedMykad}`;
            document.getElementById('pdf-phone').innerText = cachedPhone || '\u2014';
            pdfLat.innerText = currentLat;
            pdfLng.innerText = currentLng;

            // Masked video hash on screen
            pdfHash.innerText = maskedHash;

            // Image hashes — masked on screen
            const imgHashSection = document.getElementById('pdf-image-hashes-section');
            const imgHashList = document.getElementById('pdf-image-hashes-list');
            if (imageHashesFull.length > 0) {
                imgHashList.innerHTML = imageHashesFull.map((h, i) =>
                    `<div style="margin-bottom:6px;"><span style="font-weight:800;color:#166534;">Gambar ${i + 1}:</span> <span class="img-hash-masked">${h.substring(0, 8) + '\u2022'.repeat(56)}</span></div>`
                ).join('');
                imgHashSection.style.display = 'block';
            } else {
                imgHashSection.style.display = 'none';
            }

            pdfRoad.innerText = formatKeadaanJalan(roadCondition);
            pdfWeather.innerText = formatCuaca(weatherCondition);
            pdfInjury.innerText = formatKecederaan(injuryStatus);
            pdfDescription.innerText = incidentDescription || '\u2014';

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
            showGateError('\u26a0\ufe0f Masalah sambungan semasa memuat naik. Periksa internet anda dan cuba lagi. Jika pelayan baru bangun, cuba sekali lagi dalam beberapa saat.');
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

    printBtn.addEventListener('click', () => {
        document.getElementById('report-modal').classList.add('show');
    });
    document.getElementById('btn-close-modal').addEventListener('click', () => {
        document.getElementById('report-modal').classList.remove('show');
    });
    document.getElementById('btn-use-screen').addEventListener('click', () => {
        document.getElementById('report-modal').classList.remove('show');
    });

    // ── PDF GENERATION ───────────────────────────────────────────────────────
    document.getElementById('btn-get-certified').addEventListener('click', () => {
        document.getElementById('report-modal').classList.remove('show');

        const downloadBtn = document.getElementById('print-btn');
        downloadBtn.innerText = '\u23f3 Menyediakan PDF anda...';
        downloadBtn.disabled = true;

        mapContainer.innerHTML = '';

        const mapImg = document.createElement('img');
        mapImg.id = 'pdf-map-tag';
        mapImg.crossOrigin = 'anonymous';
        mapImg.style.cssText = 'width:100%;height:220px;object-fit:cover;display:block;';

        mapImg.onload = async () => {
            // SWAP: reveal full video hash
            pdfHash.innerText = ownHashFull;

            // SWAP: reveal full image hashes
            const maskedEls = document.querySelectorAll('.img-hash-masked');
            maskedEls.forEach((el, i) => {
                if (imageHashesFull[i]) el.innerText = imageHashesFull[i];
            });

            try {
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF('p', 'mm', 'a4');
                const reportViewEl = document.getElementById('report-view');
                const sections = reportViewEl.querySelectorAll('.report-section');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const margin = 10;
                const contentWidth = pdfWidth - (margin * 2);
                let currentY = margin;

                for (let i = 0; i < sections.length; i++) {
                    const section = sections[i];
                    if (section.offsetWidth === 0 || section.offsetHeight === 0) continue;
                    const canvas = await html2canvas(section, {
                        scale: 2,
                        useCORS: true,
                        allowTaint: false,
                        backgroundColor: '#ffffff',
                        logging: false
                    });
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    const imgHeight = (canvas.height * contentWidth) / canvas.width;
                    if (currentY + imgHeight > pdfHeight - margin) {
                        pdf.addPage();
                        currentY = margin;
                    }
                    pdf.addImage(imgData, 'JPEG', margin, currentY, contentWidth, imgHeight);
                    currentY += imgHeight + 3;
                }

                const fileName = `AWAS-WRIT-${(currentWritNumber || 'LAPORAN').replace(/\//g, '-')}.pdf`;
                pdf.save(fileName);

                // SWAP BACK: mask video hash
                pdfHash.innerText = ownHashFull.substring(0, 8) + '\u2022'.repeat(56);

                // SWAP BACK: mask image hashes
                const maskedElsBack = document.querySelectorAll('.img-hash-masked');
                maskedElsBack.forEach((el, i) => {
                    if (imageHashesFull[i]) el.innerText = imageHashesFull[i].substring(0, 8) + '\u2022'.repeat(56);
                });

                mapContainer.innerHTML = `<iframe
                    src="https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(currentLng)-0.005},${parseFloat(currentLat)-0.005},${parseFloat(currentLng)+0.005},${parseFloat(currentLat)+0.005}&layer=mapnik&marker=${currentLat},${currentLng}"
                    style="width:100%;height:300px;border:none;margin-bottom:-80px;"
                    loading="lazy">
                </iframe>`;
                downloadBtn.innerText = '\u2705 PDF Dimuat Turun - Semak Fail Anda';
                downloadBtn.disabled = false;
            } catch (err) {
                // SWAP BACK on error
                pdfHash.innerText = ownHashFull.substring(0, 8) + '\u2022'.repeat(56);
                const maskedElsBack = document.querySelectorAll('.img-hash-masked');
                maskedElsBack.forEach((el, i) => {
                    if (imageHashesFull[i]) el.innerText = imageHashesFull[i].substring(0, 8) + '\u2022'.repeat(56);
                });
                mapContainer.innerHTML = `<iframe
                    src="https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(currentLng)-0.005},${parseFloat(currentLat)-0.005},${parseFloat(currentLng)+0.005},${parseFloat(currentLat)+0.005}&layer=mapnik&marker=${currentLat},${currentLng}"
                    style="width:100%;height:300px;border:none;margin-bottom:-80px;"
                    loading="lazy">
                </iframe>`;
                downloadBtn.innerText = '\ud83d\udcc4 Dapatkan Writ Balai Rasmi - RM8';
                downloadBtn.disabled = false;
                alert('RALAT: ' + err.message);
            }
        };

        mapImg.onerror = () => {
            if (ownHashFull) pdfHash.innerText = ownHashFull.substring(0, 8) + '\u2022'.repeat(56);
            mapContainer.innerHTML = `<iframe
                src="https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(currentLng)-0.005},${parseFloat(currentLat)-0.005},${parseFloat(currentLng)+0.005},${parseFloat(currentLat)+0.005}&layer=mapnik&marker=${currentLat},${currentLng}"
                style="width:100%;height:300px;border:none;margin-bottom:-80px;"
                loading="lazy">
            </iframe>`;
            downloadBtn.innerText = '\ud83d\udcc4 Dapatkan Writ Balai Rasmi - RM8';
            downloadBtn.disabled = false;
            alert('RALAT peta: Gagal memuatkan imej peta. Cuba lagi.');
        };

        mapContainer.appendChild(mapImg);
        mapImg.src = `${API_BASE}/api/maps/static?lat=${currentLat}&lng=${currentLng}&t=${Date.now()}`;
    });

    // ── FORMAT HELPERS ───────────────────────────────────────────────────────
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
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js?v=1.2.3').catch(err => console.error(err));
    });
}