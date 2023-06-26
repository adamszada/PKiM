import smtplib
import sys

def send_email(subject, body, recipient):
    sender = 'projekt.test17@gmail.com'
    password = 'armflaxmppnjnggx'
    message = f'Subject: {subject}\n\n{body}'

    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender, password)
        server.sendmail(sender, recipient, message)
        print("E-mail został wysłany!")
    except Exception as e:
        print("Wystąpił błąd podczas wysyłania e-maila:", str(e))
    finally:
        server.quit()

if __name__ == "__main__":
    subject = sys.argv[1]
    body = sys.argv[2]
    recipient = sys.argv[3]

    send_email(subject, body, recipient)
