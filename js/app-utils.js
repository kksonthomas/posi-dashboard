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

    this.showConfirm(title, text = '') {
        return Swal.fire({
            title: title,
            text: text,
            icon: 'warning',
            showCancelButton: true
        })
    }

    this.showError (title, text = '') {
        return Swal.fire({
            title: title,
            text: text,
            icon: 'error'
        })
    }
}