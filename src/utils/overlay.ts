function setupOverlayListeners() {
	const el = document.getElementById('overlay');
	if (!el) return;

	document.addEventListener('show-overlay', () => {
		el.classList.remove('opacity-0', 'invisible', 'pointer-events-none');
	});

	document.addEventListener('hide-overlay', () => {
		el.classList.add('opacity-0', 'invisible', 'pointer-events-none');
	});

	el.addEventListener('click', () => {
		document.dispatchEvent(new CustomEvent('overlay-clicked'));
	});
}

document.addEventListener('astro:page-load', setupOverlayListeners);
