document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const imageComparison = document.getElementById('imageComparison');
    const originalImage = document.getElementById('originalImage');
    const processedImage = document.getElementById('processedImage');
    const placeholderResult = document.getElementById('placeholderResult');
    const buttonsContainer = document.getElementById('buttonsContainer');
    const removeBgBtn = document.getElementById('removeBgBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const errorMsg = document.getElementById('errorMsg');
    const errorText = document.getElementById('errorText');
    const fileNameDisplay = document.getElementById('fileName');
    const loadingOverlay = document.getElementById('loadingOverlay');

    // State
    let currentFile = null;
    let processedBlobUrl = null;

    // --- drag & drop handlers ---
    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-active');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-active');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-active');

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // --- Logic ---

    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            showError('Please select a valid image file (JPG, PNG, etc).');
            return;
        }

        currentFile = file;
        showError(null); // Clear errors

        // Show file info
        fileNameDisplay.textContent = file.name;
        fileNameDisplay.classList.remove('hidden');

        // Show Original Image
        const objectUrl = URL.createObjectURL(file);
        originalImage.src = objectUrl;

        // Update UI State for "Ready to Process"
        imageComparison.classList.remove('hidden');
        buttonsContainer.classList.remove('hidden');

        // Reset Result View
        processedImage.classList.add('hidden');
        downloadBtn.classList.add('hidden');
        placeholderResult.classList.remove('hidden');

        // Cleanup old blob
        if (processedBlobUrl) {
            URL.revokeObjectURL(processedBlobUrl);
            processedBlobUrl = null;
        }

        // Scroll to comparison
        imageComparison.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    removeBgBtn.addEventListener('click', async () => {
        if (!currentFile) return;

        setLoading(true);
        showError(null);

        const formData = new FormData();
        formData.append('image_file', currentFile);
        formData.append('size', 'auto');

        try {
            const response = await fetch('/api/remove-bg', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to process image');
            }

            const blob = await response.blob();
            processedBlobUrl = URL.createObjectURL(blob);

            // Show Result
            processedImage.src = processedBlobUrl;
            processedImage.classList.remove('hidden');
            processedImage.onload = () => {
                placeholderResult.classList.add('hidden');
                downloadBtn.href = processedBlobUrl;
                downloadBtn.classList.remove('hidden');
            };

        } catch (err) {
            console.error(err);
            showError(err.message || 'Error removing background. Please try again.');
        } finally {
            setLoading(false);
        }
    });

    function setLoading(isLoading) {
        if (isLoading) {
            loadingOverlay.classList.remove('hidden');
            removeBgBtn.disabled = true;
            removeBgBtn.style.opacity = '0.7';
            removeBgBtn.style.cursor = 'not-allowed';
        } else {
            loadingOverlay.classList.add('hidden');
            removeBgBtn.disabled = false;
            removeBgBtn.style.opacity = '1';
            removeBgBtn.style.cursor = 'pointer';
        }
    }

    function showError(msg) {
        if (msg) {
            errorText.textContent = msg;
            errorMsg.classList.remove('hidden');
            // Shake animation
            errorMsg.animate([
                { transform: 'translateX(0)' },
                { transform: 'translateX(-10px)' },
                { transform: 'translateX(10px)' },
                { transform: 'translateX(0)' }
            ], { duration: 400 });
        } else {
            errorMsg.classList.add('hidden');
        }
    }
});
