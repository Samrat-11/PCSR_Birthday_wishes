// --- CONFIGURATION ---
// You must have 3 transparent PNGs inside the "templates/" folder.
// The imgRect acts as a fallback, but will now be automatically overwritten by autoDetectHole!
const TEMPLATES = [
    {
        id: 'tpl1',
        src: 'templates/template1.png', 
        thumb: 'templates/template1.png', 
        width: 1080,   
        height: 1080,  
        imgRect: { x: 61.5, y: 520, w: 370, h: 370 }, // Fallback
        shape: 'circle', 
        text: {
            name: { x: 540, y: 1000, font: 'bold 45px Inter', color: '#ffffff', align: 'center' },
            desig: { x: 540, y: 1050, font: '30px Inter', color: '#f9d988', align: 'center' }
        }
    },
    {
        id: 'tpl2',
        src: 'templates/template2.png',
        thumb: 'templates/template2.png',
        width: 1080,   
        height: 1350,  
        imgRect: { x: 61.5, y: 520, w: 370, h: 370 }, // Fallback
        shape: 'circle', 
        text: {
            name: { x: 300, y: 950, font: 'bold 50px Playfair Display', color: '#ffffff', align: 'center' },
            desig: { x: 300, y: 1000, font: '25px Inter', color: '#d59b37', align: 'center' }
        }
    },
    {
        id: 'tpl3',
        src: 'templates/template3.png',
        thumb: 'templates/template3.png',
        width: 1080,   
        height: 1080,  
        imgRect: { x: 0, y: 0, w: 1080, h: 1080 }, // Fallback, full screen
        shape: 'rectangle', 
        text: {
            name: { x: 100, y: 900, font: 'bold 60px Inter', color: '#ffffff', align: 'left' },
            desig: { x: 100, y: 960, font: '35px Inter', color: '#f9d988', align: 'left' }
        }
    }
];

// State Variables
let currentTemplate = null;
let cropper = null;
let croppedImageBase64 = null;

// --- DOM ELEMENTS ---
const uploadBox = document.getElementById('upload-box');
const imageInput = document.getElementById('image-input');
const cropArea = document.getElementById('crop-area');
const imageToCrop = document.getElementById('image-to-crop');
const finalCanvas = document.getElementById('final-canvas');
const ctx = finalCanvas.getContext('2d');

// --- INITIALIZATION ---
window.onload = () => {
    loadTemplates();
};

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    
    const target = document.getElementById(screenId);
    target.classList.remove('hidden');
    target.classList.add('active');
}

// --- AUTO DETECT HOLE ALGORITHM (WITH EDGE BUFFER FIX) ---
async function autoDetectHole(imageSource) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous"; // Crucial for GitHub Pages!
        
        img.onload = () => {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            
            tempCtx.drawImage(img, 0, 0);
            
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const data = imageData.data;

            let minX = tempCanvas.width, minY = tempCanvas.height;
            let maxX = 0, maxY = 0;
            let foundHole = false;

            // THE FIX: 50-pixel edge buffer to ignore phantom transparent pixels on the borders
            const edgeBuffer = 50; 

            for (let y = edgeBuffer; y < tempCanvas.height - edgeBuffer; y++) {
                for (let x = edgeBuffer; x < tempCanvas.width - edgeBuffer; x++) {
                    const alphaIndex = (y * tempCanvas.width + x) * 4 + 3;
                    // If pixel is mostly transparent
                    if (data[alphaIndex] < 10) { 
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                        foundHole = true;
                    }
                }
            }

            if (foundHole) {
                // Ensure the bounding box is a perfect square for the circular cropper
                const rawWidth = maxX - minX;
                const rawHeight = maxY - minY;
                const maxDim = Math.max(rawWidth, rawHeight);
                
                resolve({
                    x: minX,
                    y: minY,
                    w: maxDim,
                    h: maxDim
                });
            } else {
                resolve(null); 
            }
        };

        // THE ANTI-FREEZE GUARANTEE: If the browser blocks it, gracefully exit!
        img.onerror = () => {
            console.warn("Auto-detect blocked or image failed. Using fallback coordinates.");
            resolve(null);
        };

        img.src = imageSource;
    });
}

// --- TEMPLATE SELECTION ---
function loadTemplates() {
    const slider = document.getElementById('template-slider');
    slider.innerHTML = ''; // Clear slider to prevent duplicates

    TEMPLATES.forEach((tpl, index) => {
        const div = document.createElement('div');
        div.className = 'template-card';
        
        // Handle the initially selected template
        if(index === 0) {
            div.classList.add('selected');
            currentTemplate = tpl;
        }
        
        div.innerHTML = `<img src="${tpl.thumb}" alt="Template ${index+1}">`;
        
        // Handle user clicking a new template
        div.onclick = () => {
            document.querySelectorAll('.template-card').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            currentTemplate = tpl;
        };
        slider.appendChild(div);
    });
}

// "SMART" USE DESIGN BUTTON (Scans safely on click)
document.getElementById('btn-use-design').onclick = async () => {
    const btn = document.getElementById('btn-use-design');

    if (currentTemplate.shape === 'circle') {
        const originalText = btn.innerHTML;
        // Briefly change button text to show it is processing
        btn.innerHTML = 'SCANNING... <i class="fa-solid fa-spinner fa-spin"></i>'; 

        const coords = await autoDetectHole(currentTemplate.src);
        
        if (coords) {
            currentTemplate.imgRect = coords; // Overwrite fallback with perfect coords
            console.log("Perfect coordinates found and applied!", coords);
        }

        // Restore original text
        btn.innerHTML = originalText;
    }

    showScreen('screen-upload');
};

// --- UPLOAD & CROP ---
uploadBox.onclick = () => imageInput.click();

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            uploadBox.classList.add('hidden');
            cropArea.classList.remove('hidden');
            imageToCrop.src = event.target.result;

            if (cropper) cropper.destroy();
            
            // Calculate Aspect Ratio dynamically based on template config (auto-detected or fallback)
            const rect = currentTemplate.imgRect;
            const ratio = rect.w / rect.h;

            cropper = new Cropper(imageToCrop, {
                aspectRatio: ratio,
                viewMode: 1,
                background: false
            });
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('btn-crop-apply').onclick = () => {
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({
        width: currentTemplate.imgRect.w,
        height: currentTemplate.imgRect.h
    });
    croppedImageBase64 = canvas.toDataURL('image/png');
    showScreen('screen-details');
};

// --- GENERATION ENGINE ---
document.getElementById('btn-generate').onclick = () => {
    const name = document.getElementById('input-name').value;
    if (!name) return alert("Please enter your name.");
    
    showScreen('screen-loading');
    
    // Simulate slight loading delay for UX matching the premium feel
    setTimeout(() => {
        renderPoster();
    }, 2000); 
};

function renderPoster() {
    // Dynamically grab the width and height of the currently selected template
    const currentW = currentTemplate.width;
    const currentH = currentTemplate.height;

    finalCanvas.width = currentW;
    finalCanvas.height = currentH;
    
    // 1. Draw Background Color (Fallback)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, currentW, currentH);

    // 2. Draw User Cropped Photo
    const userImg = new Image();
    userImg.src = croppedImageBase64;
    userImg.onload = () => {
        const rect = currentTemplate.imgRect;
        
        // Save the current canvas state
        ctx.save();
        
        // Conditionally apply circular clipping mask
        if (currentTemplate.shape === 'circle') {
            ctx.beginPath();
            const centerX = rect.x + (rect.w / 2);
            const centerY = rect.y + (rect.h / 2);
            const radius = rect.w / 2;
            
            // Draw an invisible circular path
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
            ctx.closePath();
            
            // Clip the canvas to this circular path
            ctx.clip(); 
        }

        // Draw the image (it will be clipped if the template is a circle)
        ctx.drawImage(userImg, rect.x, rect.y, rect.w, rect.h);
        
        // Restore the canvas state so the template doesn't get clipped too
        ctx.restore(); 

        // 3. Draw Template PNG on top (Creating the frame effect)
        const tplImg = new Image();
        
        // CRITICAL FOR GITHUB PAGES CANVAS EXPORT
        tplImg.crossOrigin = "Anonymous";
        
        tplImg.src = currentTemplate.src;
        tplImg.onload = () => {
            // Draw using the dynamic width and height
            ctx.drawImage(tplImg, 0, 0, currentW, currentH);

            // 4. Draw Typography
            const nameStr = document.getElementById('input-name').value.toUpperCase();
            const desigStr = document.getElementById('input-designation').value;
            
            drawText(nameStr, currentTemplate.text.name);
            drawText(desigStr, currentTemplate.text.desig);

            // Transition to Result
            showScreen('screen-result');
        };
    };
}

function drawText(text, config) {
    if(!text) return;
    ctx.font = config.font;
    ctx.fillStyle = config.color;
    ctx.textAlign = config.align;
    ctx.textBaseline = 'top';
    ctx.fillText(text, config.x, config.y);
}

// --- EXPORT & SHARE OPTIONS ---
document.getElementById('btn-download-img').onclick = () => {
    const link = document.createElement('a');
    link.download = 'PCSR_Poster.jpg';
    link.href = finalCanvas.toDataURL('image/jpeg', 0.9);
    link.click();
};

document.getElementById('btn-download-pdf').onclick = () => {
    const { jsPDF } = window.jspdf;
    
    // Get the dynamic dimensions from the canvas itself
    const w = finalCanvas.width;
    const h = finalCanvas.height;
    
    // Set format dynamically based on the active template size
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [w, h] });
    const imgData = finalCanvas.toDataURL('image/jpeg', 0.9);
    pdf.addImage(imgData, 'JPEG', 0, 0, w, h);
    pdf.save('PCSR_Poster.pdf');
};

document.getElementById('btn-share').onclick = async () => {
    if (navigator.share) {
        finalCanvas.toBlob(async (blob) => {
            const file = new File([blob], 'poster.png', { type: 'image/png' });
            try {
                await navigator.share({
                    title: 'Happy Birthday PCSR',
                    text: 'I just created my personalized greeting poster!',
                    files: [file]
                });
            } catch (err) {
                console.log('Share canceled or failed', err);
            }
        }, 'image/png');
    } else {
        alert('Web Share is not supported on this browser. Please download the image and share it manually.');
    }
};

// Optional: Background Removal API Hook (Placeholder)
async function autoRemoveBackground(base64Image) {
    return base64Image; 
}
