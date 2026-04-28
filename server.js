package com.example.boardnews

import android.content.ContentValues
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            MaterialTheme {
                val vm: ActuViewModel = viewModel()
                val actus by vm.actus.collectAsState()

                var selection by remember { mutableStateOf<List<Actu>>(emptyList()) }
                var ecranSelection by remember { mutableStateOf(false) }

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(12.dp)
                ) {
                    Text("LaParentheseLudiqueNews", style = MaterialTheme.typography.headlineMedium)

                    Spacer(modifier = Modifier.height(8.dp))

                    Text("Sélection : ${selection.size} / 5")

                    Spacer(modifier = Modifier.height(8.dp))

                    Row {
                        Button(onClick = { ecranSelection = false }) {
                            Text("Actus")
                        }

                        Spacer(modifier = Modifier.width(8.dp))

                        Button(onClick = { ecranSelection = true }) {
                            Text("Ma sélection")
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    if (ecranSelection) {
                        EcranSelection(
                            selection = selection,
                            onRetirer = { actu ->
                                selection = selection.filter { it.lien != actu.lien }
                            },
                            onLire = { url -> ouvrirLien(url) },
                            onGenererCarrousel = {
                                try {
                                    selection.forEachIndexed { index, actu ->
                                        val slide = genererImageSlide(actu)

                                        sauvegarderImageDansGalerie(
                                            bitmap = slide,
                                            nomFichier = "slide_${index + 1}_${System.currentTimeMillis()}.png"
                                        )
                                    }

                                    Toast.makeText(
                                        this@MainActivity,
                                        "${selection.size} slides enregistrées 📸",
                                        Toast.LENGTH_LONG
                                    ).show()

                                } catch (e: Exception) {
                                    Toast.makeText(
                                        this@MainActivity,
                                        "Erreur : ${e.message}",
                                        Toast.LENGTH_LONG
                                    ).show()
                                }
                            }
                        )
                    } else {
                        EcranActus(
                            actus = actus,
                            selection = selection,
                            onAjouter = { actu ->
                                if (selection.size < 5) selection = selection + actu
                            },
                            onRetirer = { actu ->
                                selection = selection.filter { it.lien != actu.lien }
                            },
                            onLire = { url -> ouvrirLien(url) }
                        )
                    }
                }
            }
        }
    }

    private fun ouvrirLien(url: String?) {
        if (!url.isNullOrBlank()) {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        }
    }

    private fun genererImageSlide(actu: Actu): Bitmap {
        val largeur = 1080
        val hauteur = 1350

        val bitmap = Bitmap.createBitmap(largeur, hauteur, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)

        // Fond
        paint.color = Color.rgb(250, 248, 245)
        canvas.drawRect(0f, 0f, largeur.toFloat(), hauteur.toFloat(), paint)

        // Titre appli (modifié ici)
        paint.color = Color.rgb(35, 35, 35)
        paint.textSize = 48f
        paint.isFakeBoldText = true
        canvas.drawText("LaParentheseLudiqueNews", 60f, 120f, paint)

        // Sous-titre
        paint.textSize = 40f
        paint.isFakeBoldText = false
        canvas.drawText("Sortie / actualité jeu de société", 60f, 210f, paint)

        // Titre actu
        paint.color = Color.rgb(20, 20, 20)
        paint.textSize = 54f
        paint.isFakeBoldText = true
        canvas.drawText((actu.titre ?: "Titre inconnu").take(30), 60f, 620f, paint)

        // Date
        paint.color = Color.rgb(90, 90, 90)
        paint.textSize = 38f
        paint.isFakeBoldText = false
        canvas.drawText((actu.date ?: "Date inconnue").take(40), 60f, 700f, paint)

        return bitmap
    }

    private fun sauvegarderImageDansGalerie(bitmap: Bitmap, nomFichier: String) {
        val contentValues = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, nomFichier)
            put(MediaStore.Images.Media.MIME_TYPE, "image/png")
            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/BoardNews")
        }

        val uri = contentResolver.insert(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            contentValues
        )

        uri?.let {
            contentResolver.openOutputStream(it)?.use { stream ->
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
            }
        }
    }
}

@Composable
fun EcranActus(
    actus: List<Actu>,
    selection: List<Actu>,
    onAjouter: (Actu) -> Unit,
    onRetirer: (Actu) -> Unit,
    onLire: (String?) -> Unit
) {
    LazyColumn {
        items(actus) { actu ->
            val deja = selection.any { it.lien == actu.lien }

            CarteActu(
                actu = actu,
                boutonSelectionTexte = if (deja) "Retirer" else "Ajouter",
                boutonSelectionActif = deja || selection.size < 5,
                onSelectionClick = {
                    if (deja) onRetirer(actu) else onAjouter(actu)
                },
                onLire = { onLire(actu.lien) }
            )
        }
    }
}

@Composable
fun EcranSelection(
    selection: List<Actu>,
    onRetirer: (Actu) -> Unit,
    onLire: (String?) -> Unit,
    onGenererCarrousel: () -> Unit
) {
    if (selection.isEmpty()) {
        Text("Aucun jeu sélectionné")
    } else {
        Column {
            Button(
                onClick = onGenererCarrousel,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Générer carrousel")
            }

            Spacer(modifier = Modifier.height(12.dp))

            LazyColumn {
                items(selection) { actu ->
                    CarteActu(
                        actu = actu,
                        boutonSelectionTexte = "Retirer",
                        boutonSelectionActif = true,
                        onSelectionClick = { onRetirer(actu) },
                        onLire = { onLire(actu.lien) }
                    )
                }
            }
        }
    }
}

@Composable
fun CarteActu(
    actu: Actu,
    boutonSelectionTexte: String,
    boutonSelectionActif: Boolean,
    onSelectionClick: () -> Unit,
    onLire: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {

            if (!actu.image.isNullOrBlank()) {
                AsyncImage(
                    model = actu.image,
                    contentDescription = actu.titre ?: "",
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp),
                    contentScale = ContentScale.Crop
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(actu.titre ?: "Titre inconnu")
            Text(actu.date ?: "Date inconnue")

            Spacer(modifier = Modifier.height(8.dp))

            Row {
                Button(onClick = onLire) { Text("Lire") }

                Spacer(modifier = Modifier.width(8.dp))

                Button(
                    enabled = boutonSelectionActif,
                    onClick = onSelectionClick
                ) {
                    Text(boutonSelectionTexte)
                }
            }
        }
    }
}
