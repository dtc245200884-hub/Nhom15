const msg = document.getElementById('msg');
const params = new URLSearchParams(location.search);

if (params.get('expired')) {
    msg.textContent = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    msg.hidden = false;
}

async function loginPage() {
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    msg.textContent = '';
    msg.hidden = true;

    try {
        const r = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: document.getElementById('email').value.trim(),
                password: document.getElementById('password').value
            })
        });

        const d = await r.json();
        if (!r.ok) throw Error(d.detail || 'Đăng nhập thất bại');

        localStorage.token = d.access_token;
        location.href = '/';
    } catch (e) {
        msg.textContent = e.message;
        msg.hidden = false;
    } finally {
        btn.disabled = false;
    }
}

document.getElementById('loginBtn').addEventListener('click', (event) => {
    event.preventDefault();
    loginPage();
});
