export default class AppUtils {
    static {
        this.Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 5000,
            timerProgressBar: true,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer)
                toast.addEventListener('mouseleave', Swal.resumeTimer)
            }
        })
    }

    static showSuccessToast(text) {
        this.Toast.fire({
            icon: 'success',
            title: text
        })
    }

    static showErrorToast (text) {
        this.Toast.fire({
            icon: 'error',
            title: text
        })
    }

    static showConfirm(title, text = '') {
        return Swal.fire({
            title: title,
            text: text,
            icon: 'warning',
            showCancelButton: true
        })
    }

    static showError (title, text = '') {
        return Swal.fire({
            title: title,
            text: text,
            icon: 'error'
        })
    }

    static showSuccess (title, text = '') {
        return Swal.fire({
            title: title,
            text: text,
            icon: 'success'
        })
    }

    static showPrompt(title, text = '', options = {}) {
        return Swal.fire(Object.assign({
            title: title,
            text: text,
            input: 'text',
            icon: 'question'
        }, options))
    }
}