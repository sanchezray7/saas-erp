import Swal from 'sweetalert2'

export async function notify(msg) {
  return Swal.fire({ icon: 'success', title: msg, timer: 2000, showConfirmButton: false, toast: true, position: 'top-end' })
}

export async function alertError(title, text = '') {
  return Swal.fire({ icon: 'error', title, text })
}

export async function confirmAction({ title, text, confirmText = 'Confirmar', danger = false }) {
  const result = await Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: 'Cancelar',
    confirmButtonColor: danger ? '#d6336c' : '#2c7be5',
  })
  return result.isConfirmed
}
