const msg = document.getElementById('msg');

async function registerPage() {
    const btn = document.getElementById('registerBtn');
    btn.disabled = true;
    msg.textContent = '';
    msg.hidden = true;

    try {
        const r = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: document.getElementById('full_name').value.trim(),
                email: document.getElementById('email').value.trim(),
                password: document.getElementById('password').value
            })
        });

        const d = await r.json();
        if (!r.ok) {
            const detail = d.detail;
            let errorMessage = 'Đăng ký thất bại';

            if (typeof detail === 'string') {
                errorMessage = detail;
            } else if (Array.isArray(detail)) {
                errorMessage = detail.map(item => {
                    if (typeof item === 'string') return item;

                    if (item && typeof item === 'object') {
                        const field = Array.isArray(item.loc)
                            ? item.loc.filter(part => part !== 'body').join('.')
                            : '';

                        const message = typeof item.msg === 'string'
                            ? item.msg
                            : 'Dữ liệu không hợp lệ';

                        return field ? `${field}: ${message}` : message;
                    }

                    return 'Dữ liệu không hợp lệ';
                }).join('; ');
            } else if (detail && typeof detail === 'object'
                && typeof detail.message === 'string') {
                errorMessage = detail.message;
            }

            throw new Error(errorMessage);
        }

        alert('Đăng ký thành công. Vui lòng đăng nhập.');
        location.href = '/login';
    } catch (e) {
        msg.textContent = e.message;
        msg.hidden = false;
    } finally {
        btn.disabled = false;
    }
}

document.getElementById('registerBtn').addEventListener('click', (event) => {
    event.preventDefault();
    registerPage();
});
